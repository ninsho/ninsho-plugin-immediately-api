import { ImmediatelyAPI } from '../plugin-immediately-api'
import util from 'util'
export const log = (...args: any[]) => {
  process.stdout.write(util.format(...args) + '\n')
}

import { defaultOptions, LendType, HookAccept, E500, ErrorBase, IResult, Success } from 'ninsho-base'
import ModPg from 'ninsho-module-pg'
import ModSecure from 'ninsho-module-secure'
import Mailer from 'ninsho-module-mailer'

jest.setTimeout(8000)

/**
 * initializeLocalPlugin
 * @returns [plugin, env, pool]
 */
export function initializeLocalPlugin() {

  const pool = ModPg.init(
    {
      user: 'postgres',
      host: 'localhost',
      database: 'postgres',
      password: 'postgres',
      port: 5432,
      forceRelease: true
    }
  ).setOptions(defaultOptions)

  const secure = ModSecure.init({ secretKey: 'Abracadabra' })

  const plugin = ImmediatelyAPI.init().setModules(
    {
      options: defaultOptions,
      pool: pool,
      mailer: Mailer.initForTest(),
      secure: secure
    }
  )

  beforeEach(async function() {
    await pool.truncate(['members', 'sessions'])
    log(expect.getState().currentTestName)
  })

  return {
    plugin,
    pool,
    secure
  }
}

/**
 * hook for success
 * @returns hook callback
 */
export const TestHook = () => {
  return async (
    lend: LendType,
    accept: HookAccept
  ): Promise<IResult<any, ErrorBase>> => {
    return new Success(null)
  }
}

/**
 * hook for fail
 * @returns hook callback
 */
export const TestHookFail = () => {
  return async (
    lend: LendType,
    accept: HookAccept
  ): Promise<IResult<any, ErrorBase>> => {
    return new E500(9999)
  }
}
