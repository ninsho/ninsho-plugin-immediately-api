import { MailerStorage } from 'ninsho-module-mailer'
import { TestHook, TestHookFail, initializeLocalPlugin } from './x-service'

const { plugin } = initializeLocalPlugin()

describe('im-create', () => {

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

  it('201: Positive case', async () => {
    const res1_create = await create()
    // test
    expect(res1_create.statusCode).toEqual(201)
  })

  it('409: conflict', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.createUser<MCustomT>(
      user.name,
      user.mail,
      user.pass,
      user.ip,
      user.sessionDevice,
      { view_name: user.view_name, tel: user.tel },
    )
    // test
    if (!!!res1.fail()) throw 1
    expect(res1.statusCode).toEqual(409)
  })

  it('201: hook: onTransactionLast', async () => {
    const res1 = await plugin.createUser<MCustomT>(
      user.name,
      user.mail,
      user.pass,
      user.ip,
      user.sessionDevice,
      { view_name: user.view_name, tel: user.tel },
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
    expect(res1.statusCode).toEqual(201)
  })

  it('500: fail hook: onTransactionLast', async () => {
    const res1 = await plugin.createUser<MCustomT>(
      user.name,
      user.mail,
      user.pass,
      user.ip,
      user.sessionDevice,
      { view_name: user.view_name, tel: user.tel },
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

  it('201: sendCompleatNotice', async () => {
    const res1 = await plugin.createUser<MCustomT>(
      user.name,
      user.mail,
      user.pass,
      user.ip,
      user.sessionDevice,
      { view_name: user.view_name, tel: user.tel },
      {
        sendCompleatNotice: false
      }
    )
    if (res1.fail()) throw 1
    expect(res1.statusCode).toEqual(201)
  })

  it('201: role', async () => {
    const res1 = await plugin.createUser<MCustomT>(
      user.name,
      user.mail,
      user.pass,
      user.ip,
      user.sessionDevice,
      { view_name: user.view_name, tel: user.tel },
      {
        role: 0
      }
    )
    if (res1.fail()) throw 1
    expect(res1.statusCode).toEqual(201)
  })

  it('201: unconfirmedDataExpiryThresholdSec', async () => {
    const res1 = await plugin.createUser<MCustomT>(
      user.name,
      user.mail,
      user.pass,
      user.ip,
      user.sessionDevice,
      { view_name: user.view_name, tel: user.tel },
      {
        unconfirmedDataExpiryThresholdSec: 86400
      }
    )
    if (res1.fail()) throw 1
    expect(res1.statusCode).toEqual(201)
  })

  it('201: mailFormat', async () => {
    const res1 = await plugin.createUser<MCustomT>(
      user.name,
      user.mail,
      user.pass,
      user.ip,
      user.sessionDevice,
      { view_name: user.view_name, tel: user.tel },
      {
        mailFormat: {
          subject: 'Dear {{name}} test subject',
          body: 'Dear {{name}} test body'
        }
      }
    )
    if (res1.fail()) throw 1
    expect(res1.statusCode).toEqual(201)
    expect(MailerStorage[user.mail].mailSubject).toEqual('Dear test_user test subject')
    expect(MailerStorage[user.mail].mailBody).toEqual('Dear test_user test body')
  })

})