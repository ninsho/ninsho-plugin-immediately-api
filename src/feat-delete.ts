import { MRole, MStatus, MemberInsert, MembersCol, SessionCol, SessionInsert } from 'ninsho-base'
import { ApiSuccess, E400, E401, E403, E404, E500, IApiResult, HooksObjType, hookCall } from 'ninsho-base'
import { calibrationOfColumnsForMix, getNowUnixTime } from 'ninsho-utils'

import { mailFormat } from './format-email'
import { ImmediatelyAPIConfig, LendOfHere } from './plugin-immediately-api'

export class DeleteUser {

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
    ip: string,
    sessionDevice: string,
    options?: {
      pass?: string,
      physical_deletion?: boolean,
      overwritePossibleOnLogicallyDeletedData?: boolean,
      rolePermissionLevel?: number,
      userAgent?: string,
      sendCompleatNotice?: boolean,
      mailFormat?: {
        subject?: string,
        body?: string
      },
      columnToRetrieve?: (MembersCol | SessionCol)[] | '*',
      hooks?: HooksObjType[],
    }
  ): Promise<IApiResult<null, void, E400 | E401 | E403 | E404 | E500>> {

    const others = { passwordChecked: false }
    const lend = this.lend
    const req = {
      sessionToken,
      ip,
      sessionDevice,
      options: {
        pass: options?.pass, // Ninsho checks passwords only when there is a password
        physical_deletion: options?.physical_deletion === false ? false : true,
        overwritePossibleOnLogicallyDeletedData: options?.overwritePossibleOnLogicallyDeletedData === false ? false : true,
        rolePermissionLevel: options?.rolePermissionLevel ?? MRole.User,
        userAgent: options?.userAgent || '',
        sendCompleatNotice: options?.sendCompleatNotice === false ? false : true,
        mailFormat: {
          subject: options?.mailFormat?.subject ?? mailFormat.deletionCompleat.subject,
          body: options?.mailFormat?.body ?? mailFormat.deletionCompleat.body,
        },
        columnToRetrieve: calibrationOfColumnsForMix(options?.columnToRetrieve, [
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
    if (session.fail()) /* istanbul ignore next */ return session.pushReplyCode(2218)
    if (session.response.m_role < req.options.rolePermissionLevel) return new E403(2219)
    if (session.response.m_status != MStatus.ACTIVE) return new E403(2220)

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
      if (res.fail()) return res.pushReplyCode(2221) as any
    }

    // ..Inspect Session
    if (req.options.pass
      && !others.passwordChecked
      && !lend.modules.secure.checkHashPassword(req.options.pass, session.response.m_pass))
      return new E401(2222)

    const connection = await lend.modules.pool.beginWithClient()

    // Logout all

    const delSessions = await lend.modules.pool.deleteOrThrow<SessionInsert>(
      {
        m_name: session.response.m_name
      },
      lend.options.tableName.sessions,
      connection)
    /* istanbul ignore if */
    if (delSessions.fail()) {
      await lend.modules.pool.rollbackWithRelease(connection)
      return delSessions.pushReplyCode(2223)
    }

    // delete user

    if (req.options.physical_deletion) {
      const delMember = await lend.modules.pool.deleteOrThrow<MemberInsert>(
        {
          m_name: session.response.m_name
        },
        lend.options.tableName.members,
        connection)
      /* istanbul ignore if */
      if (delMember.fail()) {
        await lend.modules.pool.rollbackWithRelease(connection)
        return delMember.pushReplyCode(2224)
      }
    } else {
      const tmpDate = new Date().getTime()
      const updMember = await lend.modules.pool.updateOneOrThrow<MemberInsert>(
        {
          m_status: MStatus.INACTIVE,
          m_name: /* istanbul ignore next */ req.options.overwritePossibleOnLogicallyDeletedData
            ? `${tmpDate}#${session.response.m_name}`
            : session.response.m_name,
          m_mail: /* istanbul ignore next */ req.options.overwritePossibleOnLogicallyDeletedData
            ? `${tmpDate}#${session.response.m_mail}` 
            : session.response.m_mail,
        },
        {
          m_name: session.response.m_name,
          m_status: MStatus.ACTIVE
        },
        'AND',
        lend.options.tableName.members,
        connection)
      /* istanbul ignore if */
      if (updMember.fail()) {
        await lend.modules.pool.rollbackWithRelease(connection)
        return updMember.pushReplyCode(2225)
      }
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
        return res.pushReplyCode(2226) as any
      }
    }

    if (req.options.sendCompleatNotice) {
      try {
        await lend.modules.mailer.sender(
          session.response.m_mail,
          req.options.mailFormat.subject,
          req.options.mailFormat.body,
          {
            ...req,
            ...{
              name: session.response.m_name
            }
          }
        )
      } catch (e) /* istanbul ignore next */ {
        await lend.modules.pool.rollbackWithRelease(connection)
        return new E500(2227)
      }
    }

    await lend.modules.pool.commitWithRelease(connection)

    return new ApiSuccess(
      204,
      null
    )
  }
}
