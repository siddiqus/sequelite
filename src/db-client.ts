/* eslint-disable @typescript-eslint/no-explicit-any */
import { merge } from 'lodash'
import mysql2 from 'mysql2'
import { Sequelize } from 'sequelize'
import {
  mapValuesToProperTypes,
  select,
  selectOne,
  useTransaction,
} from './sequelize-utils'
import {
  DbConfig,
  DbInstance,
  DbTransaction,
  Dialect,
  QueryOptions,
} from './types'

const defaultConfigs: Record<Dialect, DbConfig> = {
  mysql: {
    dialectOptions: { decimalNumbers: true },
    define: {
      charset: 'utf8mb4',
      underscored: true,
      timestamps: true,
      collate: 'utf8mb4_unicode_ci',
    },
    dialectModule: mysql2,
    logging: false,
  },
  postgres: {
    dialectOptions: { decimalNumbers: true },
    define: {
      charset: 'utf8mb4',
      underscored: true,
      timestamps: true,
      collate: 'utf8mb4_unicode_ci',
    },
    logging: false,
  },
}

export class DbClient {
  readonly dialect: Dialect
  protected config: DbConfig

  dbInstance: DbInstance

  constructor(opts: { dialect: Dialect; config: DbConfig }) {
    const { config, dialect } = opts
    const configs = merge(defaultConfigs[dialect], config)
    configs.dialect = dialect

    this.dialect = dialect
    this.config = configs
    this.dbInstance = new Sequelize(configs)
  }

  async useTransaction<T>(
    transaction: DbTransaction | null | undefined,
    callback: (transaction: DbTransaction) => Promise<T>,
  ): Promise<T> {
    return await useTransaction(this.dbInstance, transaction, callback)
  }

  async init(): Promise<void> {
    await this.dbInstance.authenticate()
  }

  async closeConnection(): Promise<void> {
    if (this.dbInstance) {
      await this.dbInstance.close()
    }
  }

  async raw(
    query: string,
    queryOptions: QueryOptions,
  ): Promise<{
    results: any[]
    metadata: any
  }> {
    const [results, metadata] = await this.dbInstance.query(query, queryOptions)
    return {
      results,
      metadata,
    }
  }

  async selectAll(opts: {
    query: string
    queryOptions?: QueryOptions
  }): Promise<any[]> {
    const results = await select(this.dbInstance, opts.query, opts.queryOptions)

    const mappedResults = results.map((val) => mapValuesToProperTypes(val))

    return mappedResults
  }

  async selectOne(opts: {
    query: string
    queryOptions?: QueryOptions
  }): Promise<any> {
    const result = await selectOne(
      this.dbInstance,
      opts.query,
      opts.queryOptions,
    )
    return mapValuesToProperTypes(result)
  }
}
