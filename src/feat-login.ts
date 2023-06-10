import { MRole, MStatus, MemberInsert, SessionInsert } from 'ninsho-base'
import { ApiSuccess, E400, E401, E403, E404, E500, IApiResult } from 'ninsho-base'
import { HooksObjType, hookCall } from 'ninsho-base'
import { calibrationOfColumnsForMembers } from 'ninsho-utils'

import { ImmediatelyAPIConfig, LendOfHere } from './plugin-immediately-api'
import { mailFormat } from './format-email'
import { upsertSessionRowWithReturnedSessionToken } from './service-data'


export class LoginUser {

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
    name: string | undefined | null,
    mail: string | undefined | null,
    pass: string,
    ip: string,
    sessionDevice: string,
    options?: {
      rolePermissionLevel?: number,
      userAgent?: string,
      sendCompleatNotice?: boolean,
      forceAllLogout?: boolean,
      mailFormat?: {
        subject?: string,
        body?: string
      },
      columnToRetrieve?: (keyof MemberInsert)[] | '*',
      hooks?: HooksObjType[],
      m_custom?: MCustom
    }
  ): Promise<IApiResult<{
    session_token: string
  }, void, E500 | E400 | E401 | E403 | E404>> {

    const lend = this.lend
    const req = {
      name: name === '' || !name ? undefined : name,
      mail: mail === '' || !mail ? undefined : mail,
      pass,
      ip,
      sessionDevice,
      options: {
        userAgent: options?.userAgent || '',
        sendCompleatNotice: options?.sendCompleatNotice === false ? false : true,
        rolePermissionLevel: options?.rolePermissionLevel ?? MRole.User,
        forceAllLogout: options?.forceAllLogout === false ? false : true,
        mailFormat: {
          subject: options?.mailFormat?.subject ?? mailFormat.LoginCompleat.subject,
          body: options?.mailFormat?.body ?? mailFormat.LoginCompleat.body,
        },
        columnToRetrieve: calibrationOfColumnsForMembers(options?.columnToRetrieve, [
          'id',
          'm_role',
          'm_status',
          'm_name',
          'm_mail',
          'm_pass'
        ]),
        hooks: options?.hooks,
        m_custom: options?.m_custom || {},
      }
    }

    const others = { passwordChecked: false }

    const conditionSet: { m_name?: string, m_mail?: string } = {}
    if (req.name) conditionSet.m_name = req.name
    if (req.mail) conditionSet.m_mail = req.mail
    if (!Object.keys(conditionSet).length) return new E400(2253)

    const sel = await lend.modules.pool.selectOneOrThrow<MemberInsert>(
      lend.options.tableName.members,
      req.options.columnToRetrieve,
      conditionSet, 'AND'
    )
    if (sel.fail()) return sel.pushReplyCode(2230)
    if (sel.response.m_role < req.options.rolePermissionLevel) return new E403(2231)
    if (sel.response.m_status != MStatus.ACTIVE) return new E403(2232)

    if (req.options.hooks) {
      const res = await hookCall('beforePasswordCheck', lend, {
        req,
        props: sel.response,
        others
      })
      if (res.fail()) return res.pushReplyCode(2233) as any
    }

    if (!others.passwordChecked && !lend.modules.secure.checkHashPassword(req.pass, sel.response.m_pass))
      return new E401(2234)

    const connection = await lend.modules.pool.beginWithClient()

    // force all signOut
    if (req.options.forceAllLogout) {
      const del = await lend.modules.pool.delete<SessionInsert>(
        { m_name: req.name },
        lend.options.tableName.sessions,
        connection
      )
      /* istanbul ignore if */
      if (del.fail()) {
        await lend.modules.pool.rollbackWithRelease(connection)
        return del.pushReplyCode(2235)
      }
    }

    const resUpsert = await upsertSessionRowWithReturnedSessionToken (
      lend,
      sel.response.id,
      sel.response.m_role,
      sel.response.m_name,
      req.ip,
      req.sessionDevice,
      connection
    )
    /* istanbul ignore if */
    if (resUpsert.fail()) return resUpsert.pushReplyCode(2236)

    if (req.options.hooks) {
      const res = await hookCall('onTransactionLast', lend, {
        req,
        props: sel.response,
        connection
      })
      if (res.fail()) {
        await lend.modules.pool.rollbackWithRelease(connection)
        return res.pushReplyCode(2237) as any
      }
    }

    if (req.options.sendCompleatNotice) {
      try {
        await lend.modules.mailer.sender(
          sel.response.m_mail,
          req.options.mailFormat.subject,
          req.options.mailFormat.body,
          {
            ...req,
            ...{
              name: sel.response.m_name,
              sessionToken: resUpsert.response.sessionToken
            }
          }
        )
      } catch (e) /* istanbul ignore next */ {
        await lend.modules.pool.rollbackWithRelease(connection)
        return new E500(2238)
      }
    }

    await lend.modules.pool.commitWithRelease(connection)

    return new ApiSuccess(
      200,
      {
        session_token: resUpsert.response.sessionToken
      }
    )

  }
}
