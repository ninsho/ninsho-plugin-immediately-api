import { MemberInsert } from 'ninsho-base'
import { MailerStorage } from 'ninsho-module-mailer'
import { mailFormat } from '../format-email'
import { TestHook, TestHookFail, initializeLocalPlugin } from './x-service'
import { matchForUUID } from './x-utils'

const { pool, plugin, secure } = initializeLocalPlugin()

describe('im-change-password', () => {

  const user = {
    name: 'test_user',
    mail: 'test@localhost_com',
    pass: 'test1234',
    newPassword: 'new_password',
    ip: '127.0.0.1',
    sessionDevice: 'test-client',
    view_name: 'is test view',
    tel: '000-0000-0001'
  }

  type MCustomT = Partial<{
    view_name: string,
    tel: string
  }>

  const create = async () => {
    const res = await plugin.createUser<MCustomT>(
      user.name,
      user.mail,
      user.pass,
      user.ip,
      user.sessionDevice,
      {
        view_name: user.view_name,
        tel: user.tel
      }
    )
    if (res.fail()) throw 100
    return res
  }

  it('200: Positive case', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.changePassword(
      res1_create.body.session_token,
      user.newPassword,
      user.ip,
      user.sessionDevice
    )
    if (res1.fail()) throw 1
    // expect
    expect(res1.statusCode).toEqual(200)
    expect(res1.body).toEqual(expect.objectContaining({ session_token: matchForUUID }))
    // expect
    const db = await pool.selectOneOrThrow<MemberInsert>('members', [ 'm_pass' ],  { m_name: user.name }, 'AND')
    if (db.fail()) throw 2
    expect(secure.checkHashPassword(user.newPassword, db.response.m_pass)).toEqual(true)
  })

  it('200: hook: beforePasswordCheck', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.changePassword(
      res1_create.body.session_token,
      user.newPassword,
      user.ip,
      user.sessionDevice,
      {
        hooks: [
          {
            hookPoint: 'beforePasswordCheck',
            hook: TestHook()
          }
        ]
      }
    )
    if (res1.fail()) throw 1
    // expect
    expect(res1.statusCode).toEqual(200)
  })

  it('200: hook: onTransactionLast', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.changePassword(
      res1_create.body.session_token,
      user.newPassword,
      user.ip,
      user.sessionDevice,
      {
        hooks: [
          {
            hookPoint: 'onTransactionLast',
            hook: TestHook()
          }
        ]
      }
    )
    if (res1.fail()) throw 1
    // expect
    expect(res1.statusCode).toEqual(200)
  })

  it('200: fail hook: beforePasswordCheck', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.changePassword(
      res1_create.body.session_token,
      user.newPassword,
      user.ip,
      user.sessionDevice,
      {
        hooks: [
          {
            hookPoint: 'beforePasswordCheck',
            hook: TestHookFail()
          }
        ]
      }
    )
    if (!!!res1.fail()) throw 1
    // expect
    expect(res1.statusCode).toEqual(500)
  })

  it('200: fail hook: onTransactionLast', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.changePassword(
      res1_create.body.session_token,
      user.newPassword,
      user.ip,
      user.sessionDevice,
      {
        hooks: [
          {
            hookPoint: 'onTransactionLast',
            hook: TestHookFail()
          }
        ]
      }
    )
    if (!!!res1.fail()) throw 1
    // expect
    expect(res1.statusCode).toEqual(500)
  })

  it('200: good password', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.changePassword(
      res1_create.body.session_token,
      user.newPassword,
      user.ip,
      user.sessionDevice, {
        pass: user.pass
      }
    )
    if (res1.fail()) throw 1
    // expect
    expect(res1.statusCode).toEqual(200)
    expect(res1.body).toEqual(expect.objectContaining({ session_token: matchForUUID }))
    // expect
    const db = await pool.selectOneOrThrow<MemberInsert>('members', [ 'm_pass' ],  { m_name: user.name }, 'AND')
    if (db.fail()) throw 2
    expect(secure.checkHashPassword(user.newPassword, db.response.m_pass)).toEqual(true)
  })

  it('200: bad password', async () => {
    // data create
    const res1_create = await create()
    // test
    const res1 = await plugin.changePassword(
      res1_create.body.session_token,
      user.newPassword,
      user.ip,
      user.sessionDevice, {
        pass: user.pass + 'XXX'
      }
    )
    if (!!!res1.fail()) throw 1
    // expect
    expect(res1.statusCode).toEqual(401)
  })

  it('403: role', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.changePassword(
      res1_create.body.session_token,
      user.newPassword,
      user.ip,
      user.sessionDevice,
      {
        rolePermissionLevel: 1
      }
    )
    if (!!!res1.fail()) throw 1
    // expect
    expect(res1.statusCode).toEqual(403)
  })

  it('200: sendCompleatNotice', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.changePassword(
      res1_create.body.session_token,
      user.newPassword,
      user.ip,
      user.sessionDevice,
      {
        sendCompleatNotice: false
      }
    )
    if (res1.fail()) throw 1
    // expect
    expect(res1.statusCode).toEqual(200)
  })

  it('204: sendCompleatNotice', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.changePassword(
      res1_create.body.session_token,
      user.newPassword,
      user.ip,
      user.sessionDevice,
      {
        forceAllLogout: false
      }
    )
    if (res1.fail()) throw 1
    // expect
    expect(res1.statusCode).toEqual(204)
  })

  it('200: mail format default', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.changePassword(
      res1_create.body.session_token,
      user.newPassword,
      user.ip,
      user.sessionDevice
    )
    if (res1.fail()) throw 1
    // expect
    expect(res1.statusCode).toEqual(200)
    expect(MailerStorage[user.mail].mailSubject).toEqual(mailFormat.ChangePasswordCompleat.subject)
    expect(MailerStorage[user.mail].mailBody).toEqual(mailFormat.ChangePasswordCompleat.body)
  })

  it('200: mail format', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.changePassword(
      res1_create.body.session_token,
      user.newPassword,
      user.ip,
      user.sessionDevice,
      {
        mailFormat: {
          subject: 'Dear {{name}}. subject test',
          body: 'Dear {{name}}. body test'
        }
      }
    )
    if (res1.fail()) throw 1
    // expect
    expect(res1.statusCode).toEqual(200)
    expect(MailerStorage[user.mail].mailSubject).toEqual('Dear test_user. subject test')
    expect(MailerStorage[user.mail].mailBody).toEqual('Dear test_user. body test')
  })

  it('401: no session', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.changePassword(
      res1_create.body.session_token + 'XXX',
      user.newPassword,
      user.ip,
      user.sessionDevice
    )
    if (!!!res1.fail()) throw 1
    // expect
    expect(res1.statusCode).toEqual(401)
  })

  it('403: status', async () => {
    const res1_create = await create()
    // break
    await pool.updateOneOrThrow<MemberInsert>({ m_status: 9 }, { m_name: user.name }, "AND", 'members')
    // test
    const res1 = await plugin.changePassword(
      res1_create.body.session_token,
      user.newPassword,
      user.ip,
      user.sessionDevice
    )
    if (!!!res1.fail()) throw 1
    // expect
    expect(res1.statusCode).toEqual(403)
  })

})
