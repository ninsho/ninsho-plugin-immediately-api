import { ModuleBase } from 'ninsho-base'
import { IOptions, ModulesStoreType, PluginBase } from 'ninsho-base'
import { DeepPartial, mergeDeep } from 'ninsho-utils'
import { CreateUser } from './feat-create'
import { LoginUser } from './feat-login'
import { ChangeEmail } from './feat-change-email'
import { ChangePassword } from './feat-change-password'
import { DeleteUser } from './feat-delete'

// - Code required for each plugin -
const pluginName = 'ImmediatelyAPI' // plugin Name
const dependencyModules = ['pool', 'mailer', 'secure'] as const // Required Modules Name

// - boiler template - Specify types only for the modules being used.
export type LendOfHere = {
  options: IOptions,
  modules: Pick<ModulesStoreType, typeof dependencyModules[number]>,
}

export type ImmediatelyAPIConfig = {
  unconfirmedDataExpiryDefaultThresholdSec: number
}

const defaultConfig: ImmediatelyAPIConfig = {
  unconfirmedDataExpiryDefaultThresholdSec: 86400
}

export class ImmediatelyAPI extends PluginBase {

  // - boiler template - 
  readonly pluginName = pluginName

  // - boiler template - store modules
  setModules(
    modules: { [keys: string]: ModuleBase | IOptions }
  ): Omit<this, 'pluginName' | 'config' | 'setModules'> {
    this.storeModules(modules, pluginName, dependencyModules)
    return this
  }

  // - plugin specific options -
  config = {} as ImmediatelyAPIConfig
  static init(options: DeepPartial<ImmediatelyAPIConfig> = {}) {
    const instance = new this()
    instance.config = mergeDeep(defaultConfig, options) as ImmediatelyAPIConfig
    return instance
  }

  changeEmail = ChangeEmail.init(this.lend, this.config)
  changePassword = ChangePassword.init(this.lend, this.config)
  createUser = CreateUser.init(this.lend, this.config)
  deleteUser = DeleteUser.init(this.lend, this.config)
  loginUser = LoginUser.init(this.lend, this.config)
}
