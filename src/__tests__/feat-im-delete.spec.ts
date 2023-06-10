import { MStatus, MemberInsert } from 'ninsho-base'
import { MailerStorage } from 'ninsho-module-mailer'
import { TestHook, TestHookFail, initializeLocalPlugin } from './x-service'

const { pool, plugin } = initializeLocalPlugin()

describe('im-delete', () => {

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

  it('204: Positive case', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.deleteUser(
      res1_create.body.session_token,
      user.ip,
      user.sessionDevice
    )
    if (res1.fail()) throw 1
    expect(res1.statusCode).toEqual(204)
  })

  it('201: hook: beforePasswordCheck', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.deleteUser(
      res1_create.body.session_token,
      user.ip,
      user.sessionDevice, {
      hooks: [
        {
          hookPoint: 'beforePasswordCheck',
          hook: TestHook()
        }
      ]
    }
    )
    if (res1.fail()) throw 1
    expect(res1.statusCode).toEqual(204)
  })

  it('500: fail hook: beforePasswordCheck', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.deleteUser(
      res1_create.body.session_token,
      user.ip,
      user.sessionDevice, {
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

  it('201: hook: onTransactionLast', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.deleteUser(
      res1_create.body.session_token,
      user.ip,
      user.sessionDevice, {
      hooks: [
        {
          hookPoint: 'onTransactionLast',
          hook: TestHook()
        }
      ]
    }
    )
    if (res1.fail()) throw 1
    expect(res1.statusCode).toEqual(204)
  })

  it('500: fail hook: onTransactionLast', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.deleteUser(
      res1_create.body.session_token,
      user.ip,
      user.sessionDevice, {
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


  it('204: good password', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.deleteUser(
      res1_create.body.session_token,
      user.ip,
      user.sessionDevice, {
      pass: user.pass
    }
    )
    if (res1.fail()) throw 1
    expect(res1.statusCode).toEqual(204)
  })

  it('401: bad password', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.deleteUser(
      res1_create.body.session_token,
      user.ip,
      user.sessionDevice, {
      pass: user.pass + 'XXX'
    }
    )
    if (!!!res1.fail()) throw 1
    expect(res1.statusCode).toEqual(401)
  })

  it('204: bad password', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.deleteUser(
      res1_create.body.session_token,
      user.ip,
      user.sessionDevice, {
      physical_deletion: false
    }
    )
    if (res1.fail()) throw 1
    expect(res1.statusCode).toEqual(204)
    // expect
    const db = await pool.selectOneOrThrow<MemberInsert>('members', '*', { m_status: MStatus.INACTIVE }, 'AND')
    if (db.fail()) throw 2
    expect(!!db.response?.m_name.match(new RegExp('^\\d+#' + user.name + '$'))).toEqual(true)
    // expect
    const diff_updated_at = new Date().getTime() - (new Date(db.response.updated_at)).getTime()
    expect(diff_updated_at < 500).toEqual(true)

  })

  it('204: options.overwritePossibleOnLogicallyDeletedData', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.deleteUser(
      res1_create.body.session_token,
      user.ip,
      user.sessionDevice,
      {
        overwritePossibleOnLogicallyDeletedData: false,
      }
    )
    if (res1.fail()) throw 1
    expect(res1.statusCode).toEqual(204)
  })

  it('204: options.overwritePossibleOnLogicallyDeletedData', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.deleteUser(
      res1_create.body.session_token,
      user.ip,
      user.sessionDevice,
      {
        overwritePossibleOnLogicallyDeletedData: true,
        sendCompleatNotice: false,
      }
    )
    if (res1.fail()) throw 1
    expect(res1.statusCode).toEqual(204)
  })

  it('403: role', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.deleteUser(
      res1_create.body.session_token,
      user.ip,
      user.sessionDevice,
      {
        rolePermissionLevel: 1,
      }
    )
    if (!!!res1.fail()) throw 1
    expect(res1.statusCode).toEqual(403)
  })

  it('401: no session', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.deleteUser(
      res1_create.body.session_token + 'XXX',
      user.ip,
      user.sessionDevice
    )
    if (!!!res1.fail()) throw 1
    expect(res1.statusCode).toEqual(401)
  })

  it('403: status', async () => {
    const res1_create = await create()
    // break
    await pool.updateOneOrThrow<MemberInsert>({ m_status: 9 }, { m_name: user.name }, 'AND', 'members')
    // test
    const res1 = await plugin.deleteUser(
      res1_create.body.session_token,
      user.ip,
      user.sessionDevice
    )
    if (!!!res1.fail()) throw 1
    expect(res1.statusCode).toEqual(403)
  })

  it('204: mail format', async () => {
    const res1_create = await create()
    // test
    const res1 = await plugin.deleteUser(
      res1_create.body.session_token,
      user.ip,
      user.sessionDevice,
      {
        mailFormat: {
          subject: 'Dear {{name}}.test subject',
          body: 'Dear {{name}}.test body',
        }
      }
    )
    if (res1.fail()) throw 1
    expect(res1.statusCode).toEqual(204)
    expect(MailerStorage[user.mail].mailSubject).toEqual('Dear test_user.test subject')
    expect(MailerStorage[user.mail].mailBody).toEqual('Dear test_user.test body')
  })

})
