/* eslint-disable @typescript-eslint/no-explicit-any */
import camelcaseKeys from 'camelcase-keys'
import { snakeCase } from 'lodash'
import snakecaseKeys from 'snakecase-keys'
import {
  bulkInsert,
  getWhereClause,
  replaceParamsForSqlQuery,
  updateColumnsById,
  updateColumnsByQuery,
  upsertRow,
} from '../sequelize-utils'
import { DbTransaction, QueryOptions } from '../types'
import { BaseAttributes, BaseModel } from './base-model'

export abstract class BaseSqlModel<
  Attributes extends BaseAttributes
> extends BaseModel<Attributes> {
  protected timezone = 'Asia/Dhaka'

  protected mapValuesToProperTypes?(val: Record<string, any>): any

  async findAll(opts?: {
    attributes?: (keyof Attributes)[]
    where?: Partial<Attributes> | string
    replacements?: Record<string, any>
    limit?: number
    offset?: number
    orderBy?: Array<[keyof Attributes, 'DESC' | 'ASC']>
    groupBy?: (keyof Attributes)[]
    transaction?: DbTransaction
    queryOptions?: QueryOptions
  }): Promise<Attributes[]> {
    const {
      where,
      replacements,
      attributes,
      limit,
      offset,
      orderBy,
      groupBy,
      transaction,
      queryOptions,
    } = opts || {}

    if (
      where &&
      typeof where === 'string' &&
      where.includes(':') &&
      (!replacements || Object.keys(replacements).length === 0)
    ) {
      throw new Error(
        // eslint-disable-next-line quotes
        "Where clause was defined with variables, but variables are not provided in 'replacements'",
      )
    }

    const whereClause = getWhereClause(where)

    let orderByClause = ''
    if (orderBy) {
      orderByClause = orderBy.map((o) => `${o[0] as string} ${o[1]}`).join(',')
    }

    const attributeStr = attributes
      ? attributes
          .map((r) => this.mapAttributeForQuery(snakeCase(r.toString())))
          .join(',')
      : '*'

    let sql = `select ${attributeStr} 
    from ${this.getTableNameForQuery()}
    ${where ? `where ${whereClause}` : ''}
    ${orderBy ? `order by ${orderByClause}` : ''}
    ${groupBy ? `group by ${groupBy.join(',')}` : ''}
    ${limit ? `limit ${limit}` : ''}
    ${offset ? `offset ${offset}` : ''}`

    sql = replaceParamsForSqlQuery(sql, replacements)

    let results = await this.dbClient.selectAll({
      query: sql,
      queryOptions: {
        transaction,
        ...queryOptions,
      },
    })

    if (this.mapValuesToProperTypes !== undefined) {
      const mapper = this.mapValuesToProperTypes
      results = results.map((val) => mapper(val))
    }

    return camelcaseKeys(results)
  }

  async findOne(opts?: {
    attributes?: (keyof Attributes)[]
    where?: Partial<Attributes> | string
    replacements?: Record<string, any>
    orderBy?: Array<[keyof Attributes, 'DESC' | 'ASC']>
    transaction?: DbTransaction
    queryOptions?: QueryOptions
  }): Promise<Attributes | null> {
    const result = await this.findAll({
      ...(opts || {}),
      limit: 1,
    })
    return result[0] || null
  }

  async findById(opts: {
    id: number
    attributes?: (keyof Attributes)[]
    transaction?: DbTransaction
  }): Promise<Attributes | null> {
    return await this.findOne({
      attributes: opts.attributes,
      transaction: opts.transaction,
      where: `id = ${opts.id}`,
    })
  }

  async create(opts: {
    data: Omit<Attributes, 'id'>
    transaction?: DbTransaction
  }): Promise<Attributes> {
    const [id] = await bulkInsert({
      dialect: this.dbClient.dialect,
      sequelize: this.dbClient.dbInstance,
      tableName: this.tableName,
      transaction: opts.transaction,
      insertData: [snakecaseKeys(opts.data)],
    })

    return {
      ...(opts.data as any),
      id,
    } as Attributes
  }

  async bulkCreate(opts: {
    data: Omit<Attributes, 'id'>[]
    transaction?: DbTransaction
  }): Promise<{
    firstId: number
    insertCount: number
  }> {
    const [firstId, insertCount] = await bulkInsert({
      dialect: this.dbClient.dialect,
      sequelize: this.dbClient.dbInstance,
      tableName: this.tableName,
      transaction: opts.transaction,
      insertData: snakecaseKeys(opts.data),
    })

    return {
      firstId,
      insertCount,
    }
  }

  async delete(opts: {
    where: Partial<Attributes> | string
    replacements?: Record<string, any>
    transaction?: DbTransaction
  }): Promise<void> {
    if (
      !opts.where ||
      (typeof opts.where === 'string' && !opts.where.trim()) ||
      !Object.keys(opts.where).length
    ) {
      throw new Error('where clause cannot be empty!')
    }

    const whereClause = getWhereClause(opts.where)

    await this.dbClient.dbInstance.query(
      `delete from ${this.getTableNameForQuery()} where ${whereClause}`,
      {
        transaction: opts.transaction,
        type: 'DELETE',
      },
    )
  }

  async deleteById(opts: {
    id: number
    transaction?: DbTransaction
  }): Promise<void> {
    if (!opts.id) {
      throw new Error('Must provide `id`')
    }

    await this.delete({
      where: { id: opts.id } as any,
      transaction: opts.transaction,
    })
  }

  async update(opts: {
    data: Partial<Omit<Attributes, 'id'>>
    where: Partial<Attributes> | string
    replacements?: Record<string, any>
    transaction?: DbTransaction
  }): Promise<void> {
    const whereClause = getWhereClause(opts.where, opts.replacements)
    if ((opts.data as any).id) {
      throw new Error('Cannot update id')
    }

    await updateColumnsByQuery({
      sequelize: this.dbClient.dbInstance,
      tableName: this.tableName,
      data: snakecaseKeys(opts.data),
      whereClause,
      transaction: opts.transaction,
    })
  }

  async updateById(opts: {
    id: number
    data: Partial<Omit<Attributes, 'id'>>
    transaction?: DbTransaction
  }): Promise<void> {
    const { id, data, transaction } = opts

    if ((opts.data as any).id) {
      throw new Error('Cannot update id')
    }

    await updateColumnsById({
      sequelize: this.dbClient.dbInstance,
      tableName: this.tableName,
      identityColumn: 'id',
      data: {
        id,
        ...snakecaseKeys(data),
      },
      transaction,
    })
  }

  async upsert<T extends keyof Attributes & string>(opts: {
    identityColumn: T
    data: Required<Attributes>
    transaction?: DbTransaction
  }): Promise<{
    id: number
  }> {
    const [id] = await upsertRow({
      dialect: this.dbClient.dialect,
      sequelize: this.dbClient.dbInstance,
      tableName: this.tableName,
      transaction: opts.transaction,
      identityColumn: opts.identityColumn,
      data: snakecaseKeys(opts.data),
    })
    return {
      id,
    }
  }
}
