import { MemberInsert } from 'ninsho-base'
import { MailerStorage } from 'ninsho-module-mailer'
import { mailFormat } from '../format-email'
import { TestHook, TestHookFail, initializeLocalPlugin, log } from './x-service'
import { matchForUUID } from './x-utils'

const { pool, plugin } = initializeLocalPlugin()

describe('im-change-email', () => {

  const user = {
    name: 'test_user',
    mail: 'test@localhost_com',
    newEmail: 'new@localhost_com',
    pass: 'test1234',
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
    const res1 = await plugin.changeEmail(
      res1_create.body.session_token,
      user.newEmail,
      user.ip,
      user.sessionDevice
    )
    if (res1.fail()) throw 1
    // expect
    expect(res1.statusCode).toEqual(200)
    expect(res1.body).toEqual(expect.objectContaining({ session_token: matchForUUID }))
    // expect
    const db = await pool.selectOneOrThrow<MemberInsert>('members', [ 'm_mail' ],  { m_name: user.name }, 'AND')
    if (db.fail()) throw 2
    expect(db.response?.m_mail).toEqual(user.newEmail)
  })

  it('401: no session', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.changeEmail(
      res1_create.body.session_token + 'XXX',
      user.newEmail,
      user.ip,
      user.sessionDevice
    )
    if (!!!res1.fail()) throw 1
    // expect
    expect(res1.statusCode).toEqual(401)
  })

  it('200: hook: beforePasswordCheck', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.changeEmail(
      res1_create.body.session_token,
      user.newEmail,
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
    // expect
    const db = await pool.selectOneOrThrow<MemberInsert>('members', [ 'm_mail' ], { m_name: user.name }, 'AND')
    if (db.fail()) throw 2
    expect(db.response?.m_mail).toEqual(user.newEmail)
  })


  it('500: fail hook: beforePasswordCheck', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.changeEmail(
      res1_create.body.session_token,
      user.newEmail,
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


  it('200: good password', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.changeEmail(
      res1_create.body.session_token,
      user.newEmail,
      user.ip,
      user.sessionDevice,
      {
        pass: 'test1234'
      }
    )
    if (res1.fail()) throw 1
    // expect
    expect(res1.statusCode).toEqual(200)
  })

  it('401: bad password', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.changeEmail(
      res1_create.body.session_token,
      user.newEmail,
      user.ip,
      user.sessionDevice,
      {
        pass: 'XXX'
      }
    )
    if (!!!res1.fail()) throw 1
    // expect
    expect(res1.statusCode).toEqual(401)
  })

  it('500: hook: onTransactionLast', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.changeEmail(
      res1_create.body.session_token,
      user.newEmail,
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

  it('403: role', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.changeEmail(
      res1_create.body.session_token,
      user.newEmail,
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

  it('200: notice false', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.changeEmail(
      res1_create.body.session_token,
      user.newEmail,
      user.ip,
      user.sessionDevice,
      {
        sendCompleatNotice: false
      }
    )
    if (res1.fail()) throw 1
    // expect
    expect(res1.statusCode).toEqual(200)
    expect(MailerStorage[user.newEmail]).toBeUndefined()
  })

  it('200: notice true', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.changeEmail(
      res1_create.body.session_token,
      user.newEmail,
      user.ip,
      user.sessionDevice,
      {
        sendCompleatNotice: true
      }
    )
    if (res1.fail()) { console.log(res1); throw 1 }
    // expect
    expect(res1.statusCode).toEqual(200)
    // expect
    expect(MailerStorage[user.newEmail].user_email).toEqual(user.newEmail)
    expect(MailerStorage[user.newEmail].mailSubject).toEqual(mailFormat.ChangeEmailCompleatForNEWEmail.subject)
    expect(MailerStorage[user.newEmail].mailBody).toEqual(mailFormat.ChangeEmailCompleatForNEWEmail.body)
  })

  it('200: forceAllLogout: false', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.changeEmail(
      res1_create.body.session_token,
      user.newEmail,
      user.ip,
      user.sessionDevice,
      {
        forceAllLogout: false
      }
    )
    if (res1.fail()) { console.log(res1); throw 1 }
    // expect
    expect(res1.statusCode).toEqual(204)
    expect(res1.body).toBeNull()
  })

  it('200: mail format', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.changeEmail(
      res1_create.body.session_token,
      user.newEmail,
      user.ip,
      user.sessionDevice,
      {
        sendCompleatNotice: true,
        mailFormat: {
          subject: 'Dear {{name}}. Test Subject',
          body: 'Dear {{name}}. test body'
        }
      }
    )
    if (res1.fail()) { console.log(res1); throw 1 }
    // expect
    expect(res1.statusCode).toEqual(200)
    // expect
    expect(MailerStorage[user.newEmail].user_email).toEqual(user.newEmail)
    expect(MailerStorage[user.newEmail].mailSubject).toEqual('Dear test_user. Test Subject')
    expect(MailerStorage[user.newEmail].mailBody).toEqual('Dear test_user. test body')
  })

  it('403: status', async () => {
    const res1_create = await create()
    // break
    await pool.updateOneOrThrow<MemberInsert>({ m_status: 0 }, { m_name: user.name }, 'AND', 'members')
    // test
    const res1 = await plugin.changeEmail(
      res1_create.body.session_token,
      user.newEmail,
      user.ip,
      user.sessionDevice
    )
    if (!!!res1.fail()) throw 1
    // expect
    expect(res1.statusCode).toEqual(403)
  })

  it('400: no change email', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.changeEmail(
      res1_create.body.session_token,
      user.mail,
      user.ip,
      user.sessionDevice
    )
    if (!!!res1.fail()) throw 1
    // expect
    expect(res1.statusCode).toEqual(400)
  })

})