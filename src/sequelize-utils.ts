/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable no-control-regex */
import { isNumber, remove } from 'lodash'
import moment from 'moment-timezone'
import { QueryOptions, QueryTypes, Sequelize, Transaction } from 'sequelize'
import { Dialect } from './types'

const filterUndefined = <T extends Record<string, any>>(obj: T): T => {
  return Object.entries(obj).reduce(
    (acc, [k, v]) => (v === undefined ? acc : { ...acc, [k]: v }),
    {},
  ) as T
}

const convertToMysqlTime = (dateObj: Date): string => {
  return moment(dateObj).format('YYYY-MM-DD HH:mm:ss')
}

const sqlCharacterRegex = new RegExp(`[\0\x08\x09\x1a\n\r"'\\%]`, 'g')

export function sanitizeSqlString(str: string) {
  return str.replace(sqlCharacterRegex, (char: string) => {
    switch (char) {
      case '\0':
        return '\\0'
      case '\x08':
        return '\\b'
      case '\x09':
        return '\\t'
      case '\x1a':
        return '\\z'
      case '\n':
        return '\\n'
      case '\r':
        return '\\r'
      case '"':
      // eslint-disable-next-line quotes, no-fallthrough
      case "'":
      case '\\':
      case '%':
        return `\\${char}` // prepends a backslash to backslash, percent,
      // and double/single quotes
      default:
        return char
    }
  })
}

function getJsonStringified(val: any) {
  if (!val) {
    return '{}'
  }

  try {
    const content = JSON.stringify(val)
    return content
  } catch (error) {
    return '{}'
  }
}

export const getSanitizedSqlValue = (value: any): any => {
  let newValue = value
  if (newValue === null) {
    newValue = 'null'
  } else if (value instanceof Date) {
    newValue = `'${convertToMysqlTime(newValue)}'`
  } else if (typeof value === 'object') {
    newValue = getJsonStringified(value)
    newValue = sanitizeSqlString(newValue)
    newValue = (newValue as string).replace(/\\/gim, '')
    newValue = `'${newValue}'`
  } else if (typeof value === 'string') {
    newValue = sanitizeSqlString(newValue)
    newValue = `'${newValue}'`
  }
  return newValue
}

export const generateUpdateSqlWithWhereClause = (opts: {
  tableName: string
  whereClause: string
  updateData: Record<string, any>
}) => {
  const { tableName, updateData, whereClause } = opts
  if (!updateData || !Object.keys(updateData).length) {
    return 'select 1;'
  }

  const filtered = filterUndefined(updateData)

  const tuples = Object.keys(filtered).map((key) => {
    let value = filtered[key]
    value = getSanitizedSqlValue(value)
    return `${key} = ${value}`
  })

  const sql = `update ${tableName}
  set ${tuples.join(',')}
  where ${whereClause}`

  return sql
}

const generateUpdateRowSql = (opts: {
  tableName: string
  updateData: Record<string, any>
  identityColumn: string
}) => {
  const { tableName, updateData, identityColumn } = opts
  if (!updateData || !Object.keys(updateData).length) {
    return 'select 1;'
  }
  const identifier = identityColumn
  const identifierValue = updateData[identifier]

  if (!identifierValue) {
    throw new Error(`${identifier} property not given`)
  }

  const filtered = filterUndefined(updateData)
  delete filtered[identifier]

  const tuples = Object.keys(filtered).map((key) => {
    let value = filtered[key]
    value = getSanitizedSqlValue(value)
    return `${key} = ${value}`
  })

  const sql = `update ${tableName}
  set ${tuples.join(',')}
  where ${identityColumn} = ${identifierValue}`

  return sql
}

const generateBulkUpdateSQL = (opts: {
  dialect: Dialect
  tableName: string
  updateData: Array<Record<string, any>>
  primaryKey: string
}) => {
  const { dialect, tableName, updateData, primaryKey } = opts
  if (!updateData.length) {
    return 'select 1;'
  }
  const identifier = primaryKey
  const keys = Object.keys(updateData[0])

  if (updateData.some((elem) => Object.keys(elem).length !== keys.length)) {
    throw new Error(
      'Please provide the same attributes for each element in the array',
    )
  }

  remove(keys, (k) => k === identifier)

  const tuples = updateData.map((props) => {
    const values = keys.map((key) => {
      let value = props[key]
      value = getSanitizedSqlValue(value)
      return value
    })

    const sanitizedId = getSanitizedSqlValue(props[identifier])

    return `(${sanitizedId},${values.join(',')})`
  })
  const valueList = tuples.join(',\n')

  let updateStatement = ''

  if (dialect === 'postgres') {
    const updateKeys = keys.map((key) => `${key} = excluded.${key}`).join(',\n')
    updateStatement = `ON CONFLICT (${primaryKey}) DO UPDATE SET ${updateKeys}`
  } else {
    const updateKeys = keys.map((key) => `${key} = VALUES(${key})`).join(',\n')
    updateStatement = `ON DUPLICATE KEY UPDATE ${updateKeys}`
  }

  const sql = `INSERT INTO ${tableName} (${identifier}, ${keys.join(',')})
  VALUES ${valueList}
  ${updateStatement};`
  return sql
}

const generateBulkInsertSQL = (opts: {
  dialect: Dialect
  tableName: string
  insertData: Array<Record<string, any>>
}) => {
  const { dialect, tableName, insertData } = opts
  if (!insertData.length) {
    return 'select 1;'
  }
  const keys = Object.keys(insertData[0])
  const tuples = insertData.map((props) => {
    const values = keys.map((key) => {
      let value = props[key]
      value = getSanitizedSqlValue(value)
      return value
    })

    return `(${values.join(',')})`
  })
  const valueList = tuples.join(', ')

  const keysForInsertHeading = keys
    .map((key) => (dialect === 'postgres' ? `"${key}"` : key))
    .join(',')
  const sql = `INSERT INTO ${tableName} (${keysForInsertHeading}) VALUES ${valueList};`
  return sql
}

export async function useTransaction<T>(
  sequelize: Sequelize,
  transaction: Transaction | null | undefined,
  callback: (transaction: Transaction) => Promise<T>,
): Promise<T> {
  if (transaction) {
    return callback(transaction)
  }
  return sequelize.transaction((tx) => callback(tx))
}

export async function select(
  sequelize: Sequelize,
  sqlQuery: string,
  queryOptions?: QueryOptions,
): Promise<any[]> {
  const opts = queryOptions || {}
  return await sequelize.query(sqlQuery, {
    ...opts,
    type: QueryTypes.SELECT,
  })
}

export async function selectOne(
  sequelize: Sequelize,
  sqlQuery: string,
  queryOptions?: QueryOptions,
): Promise<any> {
  const result = await select(sequelize, sqlQuery, queryOptions)
  if (result.length === 0) {
    return null
  }

  return result[0]
}

export async function updateColumnsByQuery<
  T extends { [key: string]: any }
>(opts: {
  sequelize: Sequelize
  tableName: string
  whereClause: string
  data: T
  transaction?: Transaction
}) {
  const { sequelize, tableName, data, whereClause, transaction } = opts

  return await useTransaction(sequelize, transaction, async (t) => {
    const sql = generateUpdateSqlWithWhereClause({
      tableName,
      updateData: data,
      whereClause,
    })
    return await sequelize.query(sql, {
      type: QueryTypes.UPDATE,
      raw: true,
      transaction: t,
    })
  })
}

export async function updateColumnsById<
  T extends { [key: string]: any }
>(opts: {
  sequelize: Sequelize
  tableName: string
  data: T
  identityColumn: string
  transaction?: Transaction
}) {
  const { sequelize, tableName, data, identityColumn, transaction } = opts

  const filteredData = filterUndefined(data)
  if (Object.keys(filteredData).length === 1 && filteredData[identityColumn]) {
    return
  }

  return await useTransaction(sequelize, transaction, async (t) => {
    const sql = generateUpdateRowSql({
      tableName,
      updateData: filteredData,
      identityColumn,
    })
    return await sequelize.query(sql, {
      type: QueryTypes.UPDATE,
      raw: true,
      transaction: t,
    })
  })
}

export async function bulkInsert<T extends { [key: string]: any }>(opts: {
  dialect: Dialect
  sequelize: Sequelize
  insertData: T[]
  tableName: string
  transaction?: Transaction
}) {
  const { dialect, sequelize, tableName, insertData, transaction } = opts

  if (!insertData) {
    throw new Error('No data provided')
  }
  if (!tableName) {
    throw new Error('No tableName provided')
  }

  if (!insertData.length) {
    return [0, 0]
  }

  return await useTransaction(sequelize, transaction, async (t) => {
    const sql = generateBulkInsertSQL({
      dialect,
      tableName,
      insertData,
    })
    return await sequelize.query(sql, {
      type: QueryTypes.INSERT,
      transaction: t,
    })
  })
}

export async function bulkUpdate<T extends { [key: string]: any }>(opts: {
  dialect: Dialect
  sequelize: Sequelize
  tableName: string
  data: T[]
  primaryKey: string
  transaction?: Transaction
}) {
  const { dialect, sequelize, data, tableName, transaction, primaryKey } = opts
  if (!data) {
    throw new Error('No data provided')
  }
  if (!tableName) {
    throw new Error('No tableName provided')
  }

  if (!data.length) {
    return null
  }

  return await useTransaction(sequelize, transaction, async (t) => {
    const sql = generateBulkUpdateSQL({
      dialect,
      tableName,
      updateData: data,
      primaryKey,
    })
    return await sequelize.query(sql, {
      type: QueryTypes.INSERT,
      transaction: t,
    })
  })
}

export async function upsertRow<T extends { [key: string]: any }>(opts: {
  dialect: Dialect
  sequelize: Sequelize
  tableName: string
  data: T
  identityColumn: string
  transaction?: Transaction
}) {
  const {
    dialect,
    sequelize,
    data,
    tableName,
    transaction,
    identityColumn,
  } = opts
  if (!data) {
    throw new Error('No data provided')
  }
  if (!tableName) {
    throw new Error('No tableName provided')
  }
  return await useTransaction(sequelize, transaction, async (t) => {
    const sql = generateBulkUpdateSQL({
      dialect,
      tableName,
      updateData: [data],
      primaryKey: identityColumn,
    })
    return await sequelize.query(sql, {
      type: QueryTypes.INSERT,
      transaction: t,
    })
  })
}

export function replaceParamsForSqlQuery(
  initialStr: string,
  replacements?: Record<string, any>,
) {
  if (!initialStr || !initialStr.trim()) {
    return ''
  }
  let str = `${initialStr}`
  for (const key of Object.keys(replacements || {})) {
    str = str.replace(
      new RegExp(`:${key}`, 'gm'),
      getSanitizedSqlValue((replacements || {})[key]),
    )
  }
  return str
}

export function getWhereClause(
  where?: Record<string, any> | string,
  replacements?: Record<string, any>,
): string {
  if (!where) {
    return ''
  }

  if (typeof where === 'string') {
    return replaceParamsForSqlQuery(where, replacements)
  } else {
    const whereSqlArr = Object.keys(where).map((key) => {
      return `${key} = ${getSanitizedSqlValue(where[key])}`
    })
    const whereSql = whereSqlArr.join(' AND ')
    return replaceParamsForSqlQuery(whereSql, replacements)
  }
}

export function mapValuesToProperTypes(
  val: Record<string, any>,
  timezone = 'Asia/Dhaka',
): any {
  return Object.keys(val).reduce((obj: Record<string, any>, key) => {
    if (typeof val[key] === 'string' && val[key].match(/^\d{4}-\d{2}-\d{2}/)) {
      obj[key] = new Date(moment(obj[key]).tz(timezone).toISOString())
    } else if (isNumber(obj[key])) {
      if (
        obj[key].toString().length >= 12 &&
        moment(obj[key], 'X', true).isValid()
      ) {
        obj[key] = new Date(
          moment(obj[key], 'X', true).tz(timezone).toISOString(),
        )
      } else {
        obj[key] = Number(val[key])
      }
    } else {
      obj[key] = val[key]
    }
    return obj
  }, {})
}
