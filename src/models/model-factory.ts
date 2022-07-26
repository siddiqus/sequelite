import { MySqlModel } from './mysql-base-model'
import { PostgresModel } from './postgres-base-model'

export const abstractModelFactory = {
  mysql: MySqlModel,
  postgres: PostgresModel,
}
