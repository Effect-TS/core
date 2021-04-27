// tracing: off

import * as T from "@effect-ts/core/Effect"
import * as E from "@effect-ts/core/Either"
import { Case } from "@effect-ts/system/Case"

import type { BuiltinError, SchemaError } from "../_schema"
import { drawError } from "../_schema"
import type { These } from "../These"

export function condemn<X, E, A>(self: (a: X) => These<E, A>): (a: X) => T.IO<E, A> {
  return (x) =>
    T.suspend(() => {
      const y = self(x).effect
      if (y._tag === "Left") {
        return T.fail(y.left)
      }
      const {
        tuple: [a, w]
      } = y.right
      return w._tag === "Some" ? T.fail(w.value) : T.succeed(a)
    })
}

export class CondemnException extends Case<CondemnException, "_tag" | "toString"> {
  readonly _tag = "CondemnException"
  readonly message!: string

  toString() {
    return this.message
  }
}

export function condemnFail<X, A>(self: (a: X) => These<SchemaError<BuiltinError>, A>) {
  return (a: X, __trace?: string) =>
    T.fromEither(() => {
      const res = self(a).effect
      if (res._tag === "Left") {
        return E.left(new CondemnException({ message: drawError(res.left) }))
      }
      const warn = res.right.get(1)
      if (warn._tag === "Some") {
        return E.left(new CondemnException({ message: drawError(warn.value) }))
      }
      return E.right(res.right.get(0))
    }, __trace)
}

export function condemnDie<X, A>(self: (a: X) => These<SchemaError<BuiltinError>, A>) {
  const orFail = condemnFail(self)
  return (a: X, __trace?: string) => T.orDie(orFail(a, __trace))
}
