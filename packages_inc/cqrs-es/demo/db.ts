import { ConnectionOptions } from "typeorm"

import * as ES from "../src"

import { printTodo } from "./app"
import { DomainEvent } from "./events"

import * as T from "@matechs/core/Effect"
import * as CQ from "@matechs/cqrs"
import { dbT, DbConfig, configEnv } from "@matechs/orm"

// configure ORM db
export const dbURI: unique symbol = Symbol()

// get ORM utils for db
export const { bracketPool, withTransaction } = dbT(dbURI)

// get CQRS utils for db and event domain
export const domain = CQ.cqrs(DomainEvent, dbURI)

// define the todo aggregate by identifiying specific domain events
export const todosAggregate = domain.aggregate("todos", ["TodoAdded", "TodoRemoved"])

export const todosES = ES.aggregate(todosAggregate)

export const onTodoAdded = todosAggregate.adt.matchEffect({
  TodoAdded: ({ todo }) => printTodo(todo),
  default: () => T.unit
})

// construct a utility to instanciate the aggregate root with a specific id
export const todoRoot = (id: string) => todosAggregate.root(`todo-${id}`, [onTodoAdded])

export const dbConfigLive: DbConfig<typeof dbURI> = {
  [configEnv]: {
    [dbURI]: {
      readConfig: T.Do()
        .bind("type", T.pure("postgres"))
        .bind("name", T.pure("CONNECTION_NAME"))
        .bind("username", T.pure("DB_USER"))
        .bind("password", T.pure("DB_PASS"))
        .bind("database", T.pure("DB_NAME"))
        .bind("host", T.pure("DB_HOST"))
        .bind("port", T.pure(5432))
        .bind("synchronize", T.pure(true))
        .bindL("entities", () =>
          T.pure(
            // need to add CQ.EventLog & ES.TabaleOffset to your entities
            [CQ.EventLog, ES.TableOffset]
          )
        )
        .return((s) => s as ConnectionOptions)
    }
  }
}
