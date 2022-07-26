import { snakeCase } from 'lodash'
import snakecaseKeys from 'snakecase-keys'
import { bulkUpdate } from '../sequelize-utils'
import { DbTransaction } from '../types'
import { BaseAttributes } from './base-model'
import { BaseSqlModel } from './base-sql-model'

export abstract class PostgresModel<
  Attributes extends BaseAttributes
> extends BaseSqlModel<Attributes> {
  protected abstract tableName: string

  protected getTableNameForQuery(): string {
    return `"${this.tableName}"`
  }

  protected mapAttributeForQuery(attr: string): string {
    return `"${attr}"`
  }

  async bulkUpsert<T extends keyof Attributes & string>(opts: {
    identityColumn: T
    data: Required<Attributes>[]
    transaction?: DbTransaction
  }): Promise<void> {
    await bulkUpdate({
      dialect: 'postgres',
      sequelize: this.dbClient.dbInstance,
      tableName: this.tableName,
      transaction: opts.transaction,
      primaryKey: snakeCase(opts.identityColumn),
      data: snakecaseKeys(opts.data),
    })
  }
}
