/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { DbClient } from '../db-client'

export interface BaseAttributes {
  id: number
  createdAt?: Date
  updatedAt?: Date
}

function getConstructorNameMap(obj: object) {
  let protoConstructor = obj.constructor.prototype.__proto__.constructor

  const constructorNameMap: Record<string, number> = {
    [protoConstructor.name]: 1,
  }

  while (protoConstructor.name !== 'Function') {
    protoConstructor = protoConstructor.__proto__.constructor
    constructorNameMap[protoConstructor.name] = 1
  }

  return constructorNameMap
}

export abstract class BaseModel<Attributes extends BaseAttributes> {
  protected abstract tableName: string

  constructor(protected dbClient: DbClient) {
    const constructorNameMap = getConstructorNameMap(this)

    if (
      (constructorNameMap['MySqlModel'] && dbClient.dialect !== 'mysql') ||
      (constructorNameMap['PostgresModel'] && dbClient.dialect !== 'postgres')
    ) {
      throw new Error(
        `Cannot use ${this.constructor.name} class for ${dbClient.dialect}`,
      )
    }
  }

  protected getTableNameForQuery(): string {
    return this.tableName
  }

  protected mapAttributeForQuery(attr: string): string {
    return attr
  }
}
