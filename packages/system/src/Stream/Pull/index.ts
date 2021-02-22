import type * as A from "../../Array/core"
import type { Cause } from "../../Cause/core"
import * as O from "../../Option"
import type { Dequeue } from "../../Queue"
import * as T from "../_internal/effect"
import type { Take } from "../Take"

export type Pull<R, E, O> = T.Effect<R, O.Option<E>, A.Array<O>>

export function emit<A>(a: A) {
  return T.succeed([a])
}

export function emitChunk<A>(as: A.Array<A>) {
  return T.succeed(as)
}

export function fromDequeue<E, A>(d: Dequeue<Take<E, A>>) {
  return T.chain_(d.take, (_) => T.done(_))
}

export function fail<E>(e: E) {
  return T.fail(O.some(e))
}

export function halt<E>(e: Cause<E>) {
  return T.mapError_(T.halt(e), O.some)
}

export const empty = <A>() => T.succeed([] as A.Array<A>)

export const end = T.fail(O.none)
