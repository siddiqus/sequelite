import { snakeCase } from 'lodash'
import snakecaseKeys from 'snakecase-keys'
import { bulkUpdate } from '../sequelize-utils'
import { DbTransaction } from '../types'
import { BaseAttributes } from './base-model'
import { BaseSqlModel } from './base-sql-model'

export abstract class MySqlModel<
  Attributes extends BaseAttributes
> extends BaseSqlModel<Attributes> {
  async bulkUpdate<T extends keyof Attributes & string>(opts: {
    identityColumn: T
    data: (Partial<Attributes> & { [key in T]: Attributes[T] })[]
    transaction?: DbTransaction
  }): Promise<void> {
    await bulkUpdate({
      dialect: 'mysql',
      sequelize: this.dbClient.dbInstance,
      tableName: this.tableName,
      transaction: opts.transaction,
      primaryKey: snakeCase(opts.identityColumn),
      data: snakecaseKeys(opts.data),
    })
  }
}
