# Sequelite
### A lightweight TypeScript ORM for queries, based on Sequelize

[![npm version](https://badge.fury.io/js/@siddiqus%2Fsequelite.svg)](https://badge.fury.io/js/@siddiqus%2Fsequelite)

# 🚀 Features
- 🔥 Fully TypeScript
- 🔒 Type safety for model properties for CRUD operations
- 🛠️ Configurable with [Sequelize](https://github.com/sequelize/sequelize) under the hood
- 🔌 Currently supporting `MySQL` and `Postgres`
- 🐫 Camelcase to snakecase mapping internally
- 🔀 Query response data type mapping to Javascript native types e.g. Number, Date

# 📖 Table of Contents

- [🚀 Features](#---features)
- [📦 Install](#---install)
- [⚙️ Setup](#---setup)
    + [Sample model declaration](#sample-model-declaration)
    + [Sample initialization in db/index.ts](#sample-initialization-in--db-indexts-)
    + [Usage in services](#usage-in-services)
      - [Model Queries](#model-queries)
      - [Supported functions](#supported-functions)
      - [Raw Queries](#raw-queries)
- [💻 Model Instance Methods](#---model-instance-methods)
    + [Common MySQL instance methods](#common-mysql-instance-methods)
      - [*create*](#-create-)
      - [*bulkCreate*](#-bulkcreate-)
      - [*findOne*](#-findone-)
      - [*findAll*](#-findall-)
      - [*findById*](#-findbyid-)
      - [*update*](#-update-)
      - [*updateById*](#-updatebyid-)
      - [*delete*](#-delete-)
      - [*deleteById*](#-deletebyid-)
      - [*upsert*](#-upsert-)
    + [MySqlModel Extras](#mysqlmodel-extras)
      - [*bulkUpdate*](#-bulkupdate-)
    + [PostgresModel Extras](#postgresmodel-extras)
      - [*bulkUpsert*](#-bulkupsert-)
- [✏️ Notes](#---notes)

<small><i><a href='http://ecotrust-canada.github.io/markdown-toc/'>Table of contents generated with markdown-toc</a></i></small>

##### Constraints
- Table column names are lowercase snake case
- All tables have an integer `id` column
- Each table should have a `created_at` and `updated_at` datetime column

# 📦 Install

- For NPM: `npm i -S @siddiqus/sequelite`
- For Yarn: `yarn add @siddiqus/sequelite`


# ⚙️ Setup

The recommended folder structure for keeping the database models is shown below:

```
project
└─── src
     |─── server.ts
     |         ...
     └─── db
          │─── index.ts
          └─── models
               │   SomeModel.ts
               │   SomeOtherModel.ts
               |   ...
     └─── services
          |    SomeService.ts
          |    ...
     
```

Here `server.ts` holds the application initialization (e.g. for NestJS `main.ts`)

### Sample model declaration

The package exposes two main model base classes `PostgresModel` and `MySqlModel`, which you will need to extend as per your database. To declare a model, you need to 
1. Declare an interface for your data model extending `BaseAttributes`
2. Declare a model class extending your respective db base model, passing the interface as the generic for the respective base DB class
3. Declare a `tableName` in the model class

For example, for `postgres:`

```typescript
// src/db/models/SomeModel.ts
import { BaseAttributes, PostgresModel } from '@siddiqus/sequelite'

// your model object with camel cas
export interface SomeModelAttributes extends BaseAttributes {
  id: number
  name: string
  age: number
  dob: Date
  joinedAt: Date
  isActive?: boolean
}

// pass the attributes interface as the generic type for the model
export class SomeModel extends PostgresModel<SomeModelAttributes> {
  // declare the table name here
  protected tableName = 'some_table'
}
```

### Sample initialization in `db/index.ts`

```typescript
// src/db/index.ts
import { DbClient } from '@siddiqus/sequelite'
import { SomeModel } from './SomeModel.ts'
import { SomeOtherModel } from './SomeOtherModel.ts'

export const dbClient = new DbClient({
  dialect: 'postgres', // currently supported 'mysql' and 'postgres'
  config: {
    host: '35.240.243.87',
    database: 'eloan_stage',
    username: 'postgres',
    password: 'Shopsql@65',
  },
})

// this map will be passed into the DB client initializer
// having all your models in this map will allow you to run proper model queries
const modelClassMap = {
  SomeModel,
  SomeOtherModel,
}

export type Models = Record<
  keyof typeof modelClassMap,
  InstanceType<typeof modelClassMap[keyof typeof modelClassMap]>
>

// this is a map of queryable models, see example below
export const models: Models = Object.keys(modelClassMap).reduce(
  (obj: Models, key: string) => {
    const modelName = key as keyof typeof modelClassMap
    obj[modelName] = new modelClassMap[modelName](dbClient)
    return obj
  },
  {} as Models,
)
```

### Usage in services

#### Model Queries

After declaring and exporting your `dbClient` instance, you can use it anywhere in your project. For example:

```typescript
// src/services/SomeService.ts
import { models } from '../db'
import { SomeAttributes } from '../db/SomeModel'

async function getSomeData() {
  // models.* will have intellisense in VS Code!
  // return type of findAll is infered from the model attributes
  // the SomeModel instance exposes standard methods for queries
  return await models.SomeModel.findAll({
    where: {
      name: 'Sabbir',
    },
  })
}

async function createSomeData() {
  // the data property will have intellisense from model attributes
  return await models.SomeModel.create({
    data: {
      age: 33,
      dob: new Date('1991-02-01'),
      joinedAt: new Date(),
      name: 'Sabbir Siddiqui',
    },
  })
}
```

#### Supported functions

#### Raw Queries

You can declare models and get type sensitive code, but also do raw queries through `dbClient`. For example:

```typescript
import { dbClient } from '../db'

async function fetchData(): Promise<any> {
  return await dbClient.selectAll({
    query: `select * from some_table`,
    queryOptions: {} // optional sequelize query parameters
  })
}

async function fetchSingleData(): Promise<any> {
  return await dbClient.selectOne({
    query: `select * from some_table where id = 1`,
    queryOptions: {} // optional sequelize query parameters
  })
}
```

# 💻 Model Instance Methods

Going forward, let's assume `Attributes` is your interface for your model object (which extends `BaseAttributes` from this package).

### Common SQL instance methods

#### *create*
```typescript
async create(opts: {
  data: Omit<Attributes, 'id'>
  transaction?: DbTransaction
}): Promise<Attributes>
```
Input Parameters:
- *data* - all attributes except for id
- *transaction* - database transaction object (from sequelize)

Output:
- A promise which resolves to an object of your respective `Attributes` type, including the new record `id`

Example:
```typescript
const newRecord = await model.create({
  data: {
    name: 'Sabbir',
    dob: '1991-02-01'
  }
})

console.log(newRecord.id) // new inserted id
```
***
#### *bulkCreate*
```typescript
async bulkCreate(opts: {
  data: Omit<Attributes, 'id'>[]
  transaction?: DbTransaction
}): Promise<{
  firstId: number
  insertCount: number
}>
```
Input Parameters:
- *data* - a list of objects with all attributes except for id
- *transaction* - database transaction object (from sequelize)

Output:
- A promise which resolves to an object containing the first `id` inserted, and the number of items inserted

Example:
```typescript
await bulkCreate({
  data: [
    {
      name: 'John',
      dob: '1991-02-01'
    },
    {
      name: 'Jane',
      dob: '1993-02-01'
    },
  ]
})
```

***
#### *findOne*
```typescript
async findOne(opts?: {
  attributes?: (keyof Attributes)[]
  where?: Partial<Attributes> | string
  replacements?: Record<string, any>
  orderBy?: Array<[keyof Attributes, 'DESC' | 'ASC']>
  transaction?: DbTransaction
  queryOptions?: QueryOptions
}): Promise<Attributes | null> 
```
Input Parameters:
- *attributes* - a typed list of keys from your `Attributes` interface
- *where* - a string for raw queries, or an object with keys from `Attributes` interface
- *replacements* - an object mapping for SQL safe string interpolation for the where clause
- *orderBy* - option for ordering result as per `Attributes` key
- *transaction* - database transaction object (from sequelize)

Output:
- A promise which resolves to an object of your respective `Attributes` type, or `null`

Example:
```typescript
// will return the name and dob columns for the row where id = 1 
const result = await model.findOne({
  attributes: ['name', 'dob'],
  where: {
    id: 1
  }
})
```

***

#### *findAll*
```typescript
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
```
Input Parameters:
- *attributes* - a typed list of keys from your `Attributes` interface
- *where* - a string for raw queries, or an object with keys from `Attributes` interface
- *replacements* - an object mapping for SQL safe string interpolation for the where clause
- *limit* - number of results to return
- *offset* - query offset
- *orderBy* - option for ordering result as per `Attributes` key
- *groupBy* - list of keys from `Attributes` for the `group by` clause
- *transaction* - database transaction object (from sequelize)

Output:
- A promise which resolves to an objects of your respective `Attributes` type, or `null`

Example:
```typescript
// will return list of results, sorted by name descending, where id in (1,2,3)
const results = await model.findAll({
  attributes: ['name', 'dob'],
  where: 'id in (:id)',
  replacements: {
    id: [1,2,3]
  },
  orderBy: ['name', 'DESC']
})
```

***
#### *findById*
```typescript
async findById(opts: {
  id: number
  attributes?: (keyof Attributes)[]
  transaction?: DbTransaction
}): Promise<Attributes | null> 
```
Input Parameters:
- *id* - the `id` to be queried
- *attributes* - a typed list of keys from your `Attributes` interface
- *transaction* - database transaction object (from sequelize)

Output:
- A promise which resolves to an object of your respective `Attributes` type, or `null`

Example:
```typescript
// will return the name and dob columns for the row where id = 1 
const result = await model.findById({
  id: 1,
  attributes: ['name', 'dob'],
})
```
***

#### *update*
```typescript
async update(opts: {
  data: Partial<Omit<Attributes, 'id'>>
  where: Partial<Attributes> | string
  replacements?: Record<string, any>
  transaction?: DbTransaction
}): Promise<void>
```
Input Parameters:
- *data* - properties to update
- *where* - a string for raw queries, or an object with keys from `Attributes` interface
- *replacements* - an object mapping for SQL safe string interpolation for the where clause
- *transaction* - database transaction object (from sequelize)

Output:
- A promise which resolves to void

Example:
```typescript
await model.update({
  data: {
    name: 'Sabbir Siddiqui',
    dob: '1991-02-03'
  },
  where: {
    id: 1
  }
})
```
***
#### *updateById*
```typescript
async updateById(opts: {
  id: number
  data: Partial<Omit<Attributes, 'id'>>
  transaction?: DbTransaction
}): Promise<void>
```
Input Parameters:
- *id* - the `id` of the row to be updated
- *data* - the updated properties (excluding `id`)
- *transaction* - database transaction object (from sequelize)

Output:
- A promise which resolves to void

Example:
```typescript
await model.updateById({
  id: 1,
  data: {
    name: 'Sabbir Siddiqui',
    dob: '1991-02-03'
  },
})
```
***
#### *delete*
```typescript
async delete(opts: {
  where: Partial<Attributes> | string
  replacements?: Record<string, any>
  transaction?: DbTransaction
}): Promise<void>
```
Input Parameters:
- *where* - a string for raw queries, or an object with keys from `Attributes` interface
- *replacements* - an object mapping for SQL safe string interpolation for the where clause
- *transaction* - database transaction object (from sequelize)

Output:
- A promise which resolves to void

Example:
```typescript
await model.delete({
  where: {
    id: 1
  }
})
```

***
#### *deleteById*
```typescript
async delete(opts: {
  id: number
  transaction?: DbTransaction
}): Promise<void>
```
Input Parameters:
- *id* - `id` of the row to be deleted
- *transaction* - database transaction object (from sequelize)

Output:
- A promise which resolves to void

Example:
```typescript
await model.delete({
  where: {
    id: 1
  }
})
```

***
#### *upsert*

This method implements the `create or update` functionality. Passing the full model properties including the ID will create the row, or update all of the properties of that ID's row.

```typescript
async upsert<T extends keyof Attributes & string>(opts: {
  identityColumn: T
  data: Required<Attributes>
  transaction?: DbTransaction
}): Promise<{
  id: number
}>
```
Input Parameters:
- *identityColumn* - the identifying column name
- *data* - the full data row object to be upserted
- *transaction* - database transaction object (from sequelize)

Output:
- A promise which resolves to void

Example:
```typescript
await model.upsert({
  identityColumn: 'id',
  data: {
    id: 1,
    name: 'Sabbir Siddiqui',
    dob: '1991-02-01'
  }
})
```


Apart from these common methods, the `MySqlModel` and `PostgresModel` have some additional methods.

### MySqlModel Extras
#### *bulkUpdate*

This method updates a list of data with the same properties in bulk.

```typescript
async bulkUpdate<T extends keyof Attributes & string>(opts: {
  identityColumn: T
  data: (Partial<Attributes> & { [key in T]: Attributes[T] })[]
  transaction?: DbTransaction
}): Promise<void>
```
Input Parameters:
- *identityColumn* - the identifying column name
- *data* - the list of data including an identifier to be bulk updated; the properties have to be same for every object in the list, however it can be any subset of the properties from your model object
- *transaction* - database transaction object (from sequelize)

Output:
- A promise which resolves to void

Example:

```typescript
// This will update the respective `id` row with the respective name.
await model.bulkUpdate({
  identityColumn: 'id',
  data: [
    {
      id: 1,
      name: 'Sabbir Siddiqui'  
    },
    {
      id: 2,
      name: 'John Goodman'
    }
  ]
})
```

### PostgresModel Extras
#### *bulkUpsert*

This method upserts rows in bulk. Note, the main difference between`bulkUpdate` in MySQL and Postgres is that in MySQL, rows can be partially updated in bulk (through a subset of columns), whereas in Postgres, the `bulkUpsert` needs to have all the properties of the objects in the data list.

```typescript
async bulkUpsert<T extends keyof Attributes & string>(opts: {
  identityColumn: T
  data: Required<Attributes>[]
  transaction?: DbTransaction
}): Promise<void>
```
Input Parameters:
- *identityColumn* - the identifying column name
- *data* - the list of data including an identifier to be bulk updated; this list should have objects with all the properties of the respective data model
- *transaction* - database transaction object (from sequelize)

Output:
- A promise which resolves to void

Example:

```typescript
// This will update the respective `id` row with the respective name.
await model.bulkUpsert({
  identityColumn: 'id',
  data: [
    {
      id: 1,
      name: 'Sabbir Siddiqui',
      dob: '1991-02-01'
    },
    {
      id: 2,
      name: 'Johnny B Good',
      dob: '1968-05-27'
    }
  ]
})
```


# ✏️ Notes

##### Where Clause / Replacements
Here are some valid use cases of the `where` property in some of the model instance functions:

```typescript
// returns all matching records with id values in 1, 2, or 3
await model.findAll({
  where: 'id in (1,2,3)'
})
```

```typescript
// returns all matching records with id values in 1, 2, or 4
await model.findAll({
  where: 'id in (:id)',
  replacements: {
    id: [1,2,4]
  }
})

```

```typescript
// returns all matching records with status = pending
await model.findAll({
  where: {
    status: 'pending'
  }
})

```
<br/>
##### Camelcase / Snakcase
- We are assuming that the schema definition for your models are using snake_case, and all attributes or model representations in code are using camelCase. Hence, for example

```typescript
// when querying a model, this will produce a where clause for first_name
const results = await model.findAll({
  where: {
    firstName: 'Sabbir'
  }
})
// and similarly, in the result the first_name column will be converted back to firstName
```
<br/>
##### Node Versions
- 🔌 Currently tested on Node v12+
