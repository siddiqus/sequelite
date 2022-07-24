import {
  Options as SequelizeOptions,
  QueryOptions as SequelizeQueryOptions,
  Sequelize,
  Transaction,
} from 'sequelize'

export type Dialect = 'mysql' | 'postgres' // supported dialects

export type QueryOptions = SequelizeQueryOptions

export type DbTransaction = Transaction

export type DbConfig = SequelizeOptions

export type DbInstance = Sequelize
