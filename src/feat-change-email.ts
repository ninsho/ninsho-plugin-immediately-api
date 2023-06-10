import { MRole, MStatus, MemberInsert, MembersCol, SessionCol, SessionInsert } from 'ninsho-base'
import { ApiSuccess, E400, E401, E403, E404, E500, IApiResult, HooksObjType, hookCall } from 'ninsho-base'
import { getNowUnixTime, calibrationOfColumnsForMix } from 'ninsho-utils'

import { mailFormat } from './format-email'
import { ImmediatelyAPIConfig, LendOfHere } from './plugin-immediately-api'
import { upsertSessionRowWithReturnedSessionToken } from './service-data'

export class ChangeEmail {

  // - boiler plate -
  lend = {} as LendOfHere
  config = {} as ImmediatelyAPIConfig
  static init(lend: LendOfHere, config: ImmediatelyAPIConfig) {
    const instance = new this()
    instance.lend = lend
    instance.config = config
    return instance.method
  }

  private async method(
    sessionToken: string,
    newEmail: string,
    ip: string,
    sessionDevice: string,
    options?: {
      pass?: string,
      rolePermissionLevel?: number,
      userAgent?: string,
      sendCompleatNotice?: boolean,
      forceAllLogout?: boolean,
      mailFormat?: {
        subject?: string,
        body?: string
      },
      columnToRetrieve?: (MembersCol | SessionCol)[] | '*',
      hooks?: HooksObjType[]
    }
  ): Promise<IApiResult<{
    session_token: string
  } | null, void, E400 | E401 | E403 | E404 | E500>> {

    const others = { passwordChecked: false }
    const lend = this.lend
    const req = {
      sessionToken,
      newEmail,
      ip,
      sessionDevice,
      options: {
        pass: options?.pass, // Ninsho checks passwords only when there is a password
        rolePermissionLevel: options?.rolePermissionLevel ?? MRole.User,
        userAgent: options?.userAgent || '',
        sendCompleatNotice: options?.sendCompleatNotice === false ? false : true,
        forceAllLogout: options?.forceAllLogout === false ? false : true,
        mailFormat: {
          subject: options?.mailFormat?.subject ?? mailFormat.ChangeEmailCompleatForNEWEmail.subject,
          body: options?.mailFormat?.body ?? mailFormat.ChangeEmailCompleatForNEWEmail.body,
        },
        columnToRetrieve: calibrationOfColumnsForMix(options?.columnToRetrieve, [
          'members.id',
          'members.m_custom',
          'members.m_name',
          'members.m_mail',
          'members.m_pass',
          'members.m_role',
          'members.m_status',
          'members.version'
        ]),
        hooks: options?.hooks
      },
    }

    // Inspect Session

    const session = await lend.modules.pool.retrieveMemberIfSessionPresentOne<MemberInsert & SessionInsert>(
      lend.modules.secure.toHashForSessionToken(req.sessionToken),
      getNowUnixTime() - lend.options.sessionExpirationSec,
      req.sessionDevice,
      req.ip,
      req.options.columnToRetrieve
    )
    if (session.fail()) return session.pushReplyCode(2200)
    if (session.response.m_role < req.options.rolePermissionLevel) return new E403(2201)
    if (session.response.m_status != MStatus.ACTIVE) return new E403(2202)
    if (req.newEmail === session.response.m_mail) return new E400(2203)

    // hook:beforePasswordCheck
    if (req.options.hooks) {
      const res = await hookCall('beforePasswordCheck', lend, {
        req: {
          ...req,
          ...{
            name: session.response.m_name
          }
        },
        props: session.response,
        others
      })
      if (res.fail()) return res.pushReplyCode(2204) as any
    }

    // ..Inspect Session
    if (req.options.pass
      && !others.passwordChecked
      && !lend.modules.secure.checkHashPassword(req.options.pass, session.response.m_pass))
      return new E401(2205)

    const connection = await lend.modules.pool.beginWithClient()

    // Update Email

    const upd = await lend.modules.pool.updateOneOrThrow<MemberInsert>(
      {
        m_mail: req.newEmail
      },
      {
        m_name: session.response.m_name,
        version: session.response.version
      },
      'AND',
      lend.options.tableName.members)
    /* istanbul ignore if */
    if (upd.fail()) return upd.pushReplyCode(2206)

    // Logout all

    let newSessionToken = ''
    if (req.options.forceAllLogout) {

      const del = await lend.modules.pool.delete<SessionInsert>(
        { m_name: session.response.m_name },
        lend.options.tableName.sessions,
        connection)
      /* istanbul ignore if */
      if (del.fail()) {
        await lend.modules.pool.rollbackWithRelease(connection)
        return del.pushReplyCode(2207)
      }

      // recreate session
      const ups = await upsertSessionRowWithReturnedSessionToken(
        lend,
        session.response.id,
        session.response.m_role,
        session.response.m_name,
        ip,
        sessionDevice,
        connection
      )
      /* istanbul ignore if */
      if (ups.fail()) {
        await lend.modules.pool.rollbackWithRelease(connection)
        return ups.pushReplyCode(2208)
      }
      newSessionToken = ups.response.sessionToken
    }

    // hook:onTransactionLast
    if (req.options.hooks) {
      const res = await hookCall('onTransactionLast', lend, {
        req,
        props: session.response,
        connection
      })
      if (res.fail()) {
        await lend.modules.pool.rollbackWithRelease(connection)
        return res.pushReplyCode(2209) as any
      }
    }

    if (req.options.sendCompleatNotice) {
      try {
        await lend.modules.mailer.sender(
          req.newEmail,
          req.options.mailFormat.subject,
          req.options.mailFormat.body,
          {
            ...req,
            ...{
              name: session.response.m_name,
              sessionToken: sessionToken,
            }
          }
        )
      } catch (e) /* istanbul ignore next */ {
        await lend.modules.pool.rollbackWithRelease(connection)
        return new E500(2210)
      }
    }

    await lend.modules.pool.commitWithRelease(connection)

    return /* istanbul ignore next */ req.options.forceAllLogout
      ? new ApiSuccess(
        200,
        {
          session_token: newSessionToken
        }
      )
      : new ApiSuccess(
        204,
        null
      )
  }
}
