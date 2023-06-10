import { MRole, MStatus, MemberInsert, SessionInsert } from 'ninsho-base'
import { ApiSuccess, E409, E500, IApiResult, HooksObjType, hookCall } from 'ninsho-base'
import { getNowUnixTime } from 'ninsho-utils'

import { mailFormat } from './format-email'
import { ImmediatelyAPIConfig, LendOfHere } from './plugin-immediately-api'

export class CreateUser {

  // - boiler plate -
  lend = {} as LendOfHere
  config = {} as ImmediatelyAPIConfig
  static init(lend: LendOfHere, config: ImmediatelyAPIConfig) {
    const instance = new this()
    instance.lend = lend
    instance.config = config
    return instance.method
  }

  private async method<MCustom>(
    name: string,
    mail: string,
    pass: string,
    ip: string,
    sessionDevice: string,
    m_custom: MCustom,
    options?: {
      role?: number,
      userAgent?: string,
      sendCompleatNotice?: boolean,
      mailFormat?: {
        subject?: string,
        body?: string
      },
      unconfirmedDataExpiryThresholdSec?: number
      hooks?: HooksObjType[]
    }
  ): Promise<IApiResult<{
    session_token: string
  }, void, E500 | E409>> {

    const lend = this.lend
    const req = {
      name,
      mail,
      pass,
      ip,
      sessionDevice,
      m_custom,
      options: {
        userAgent: options?.userAgent || '',
        sendCompleatNotice: options?.sendCompleatNotice === false ? false : true,
        role: options?.role ?? MRole.User,
        mailFormat: {
          subject: options?.mailFormat?.subject ?? mailFormat.CreateCompleat.subject,
          body: options?.mailFormat?.body ?? mailFormat.CreateCompleat.body
        },
        unconfirmedDataExpiryThresholdSec: options?.unconfirmedDataExpiryThresholdSec
          ?? this.config.unconfirmedDataExpiryDefaultThresholdSec,
        hooks: options?.hooks
      }
    }

    const connection = await lend.modules.pool.beginWithClient()

    const ins = await lend.modules.pool.replaceOneWithConditionExistAndDeadLine<MemberInsert>(
      {
        m_name: req.name,
        m_pass: lend.modules.secure.toHashForPassword(req.pass),
        m_mail: req.mail,
        m_custom: req.m_custom,
        m_role: req.options.role,
        m_ip: req.ip,
        otp_hash: null,
        m_status: MStatus.ACTIVE
      },
      lend.options.tableName.members,
      req.options.unconfirmedDataExpiryThresholdSec,
      connection)
    if (ins.fail()) {
      await lend.modules.pool.rollbackWithRelease(connection)
      return ins.pushReplyCode(2214)
    }

    const { sessionToken, hashToken } = lend.modules.secure.createSessionTokenWithHash()

    const insSession = await lend.modules.pool.insertOne<SessionInsert>(
      {
        members_id: ins.response.rows[0].id,
        m_name: req.name,
        m_ip: req.ip,
        m_device: req.sessionDevice,
        created_time: getNowUnixTime(),
        token: hashToken,
        m_role: req.options.role,
      },
      lend.options.tableName.sessions,
      connection)
    /* istanbul ignore if */
    if (insSession.fail()) {
      await lend.modules.pool.rollbackWithRelease(connection)
      return insSession.pushReplyCode(2215)
    }

    if (req.options.hooks) {
      const res = await hookCall('onTransactionLast', lend, {
        req,
        connection
      })
      if (res.fail()) {
        await lend.modules.pool.rollbackWithRelease(connection)
        return res.pushReplyCode(2216) as any
      }
    }

    if (req.options.sendCompleatNotice) {
      try {
        await lend.modules.mailer.sender(
          req.mail,
          req.options.mailFormat.subject,
          req.options.mailFormat.body,
          {
            ...req,
            ...{
              sessionToken: sessionToken
            }
          }
        )
      } catch (e) /* istanbul ignore next */ {
        await lend.modules.pool.rollbackWithRelease(connection)
        return new E500(2217)
      }
    }

    await lend.modules.pool.commitWithRelease(connection)

    return new ApiSuccess(
      201,
      {
        session_token: sessionToken
      }
    )
  }
}
