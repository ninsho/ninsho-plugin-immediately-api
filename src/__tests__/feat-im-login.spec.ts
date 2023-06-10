import { MemberInsert } from 'ninsho-base'
import { MailerStorage } from 'ninsho-module-mailer'
import { TestHook, TestHookFail, initializeLocalPlugin } from './x-service'
import { matchForUUID } from './x-utils'

const { pool, plugin } = initializeLocalPlugin()

describe('im-login', () => {

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
    const res1 = await plugin.loginUser(
      user.name,
      user.mail,
      user.pass,
      user.ip,
      user.sessionDevice
    )
    if (res1.fail()) throw 1
    expect(res1.statusCode).toEqual(200)
    expect(res1.body).toEqual(expect.objectContaining({ session_token: matchForUUID }))
  })

  it('200: hook: beforePasswordCheck', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.loginUser(
      user.name,
      user.mail,
      user.pass,
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
    expect(res1.statusCode).toEqual(200)
    expect(res1.body).toEqual(expect.objectContaining({ session_token: matchForUUID }))
  })

  it('500: fail hook: beforePasswordCheck', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.loginUser(
      user.name,
      user.mail,
      user.pass,
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
    expect(res1.statusCode).toEqual(500)
  })

  it('200: hook: onTransactionLast', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.loginUser(
      user.name,
      user.mail,
      user.pass,
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
    expect(res1.statusCode).toEqual(200)
    expect(res1.body).toEqual(expect.objectContaining({ session_token: matchForUUID }))
  })

  it('500: fail hook: onTransactionLast', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.loginUser(
      user.name,
      user.mail,
      user.pass,
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
    expect(res1.statusCode).toEqual(500)
  })

  it('200: bad password', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.loginUser(
      user.name,
      user.mail,
      user.pass + 'XXX',
      user.ip,
      user.sessionDevice,
    )
    if (!!!res1.fail()) throw 1
    expect(res1.statusCode).toEqual(401)
    // expect(res1.body).toEqual(expect.objectContaining({ session_token: matchForUUID }))
  })

  it('400: name & mail null', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.loginUser(
      null,
      null,
      user.pass + 'XXX',
      user.ip,
      user.sessionDevice,
    )
    if (!!!res1.fail()) throw 1
    expect(res1.statusCode).toEqual(400)
  })

  it('400: role', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.loginUser(
      user.name,
      user.mail,
      user.pass,
      user.ip,
      user.sessionDevice, {
        rolePermissionLevel: 1
      }
    )
    if (!!!res1.fail()) throw 1
    expect(res1.statusCode).toEqual(403)
  })


  it('200: forceAllLogout', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.loginUser(
      user.name,
      user.mail,
      user.pass,
      user.ip,
      user.sessionDevice, {
        forceAllLogout: false
      }
    )
    if (res1.fail()) throw 1
    expect(res1.statusCode).toEqual(200)
  })

  it('200: mail format', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.loginUser(
      user.name,
      user.mail,
      user.pass,
      user.ip,
      user.sessionDevice, {
        mailFormat: {
          subject: 'Dear {{name}} login notice subject',
          body: 'Dear {{name}} login notice body'
        }
      }
    )
    if (res1.fail()) throw 1
    expect(res1.statusCode).toEqual(200)
    expect(MailerStorage[user.mail].mailSubject).toEqual('Dear test_user login notice subject')
    expect(MailerStorage[user.mail].mailBody).toEqual('Dear test_user login notice body')
  })

  it('404: no data', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.loginUser(
      user.name + 'XXX',
      user.mail,
      user.pass,
      user.ip,
      user.sessionDevice
    )
    if (!!!res1.fail()) throw 1
    expect(res1.statusCode).toEqual(404)
  })

  it('403: status', async () => {
    const res1_create = await create()
    // brake
    await pool.updateOneOrThrow<MemberInsert>({ m_status: 9 }, { m_name: user.name }, 'AND', 'members')
    // test
    const res1 = await plugin.loginUser(
      user.name,
      user.mail,
      user.pass,
      user.ip,
      user.sessionDevice
    )
    if (!!!res1.fail()) throw 1
    expect(res1.statusCode).toEqual(403)
  })


  it('200: Positive case', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.loginUser(
      user.name,
      user.mail,
      user.pass,
      user.ip,
      user.sessionDevice, {
        sendCompleatNotice: false
      }
    )
    if (res1.fail()) throw 1
    expect(res1.statusCode).toEqual(200)
    expect(res1.body).toEqual(expect.objectContaining({ session_token: matchForUUID }))
  })

})