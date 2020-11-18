import { flow } from "../Function"
import { traceFrom, traceWith } from "../Tracing"
import { chain_, succeed } from "./core"
import type { Effect } from "./effect"

/**
 * Returns an effect whose success is mapped by the specified `f` function.
 */
export function map_<R, E, A, B>(_: Effect<R, E, A>, f: (a: A) => B) {
  const trace = flow(traceFrom(f), traceWith("map"))
  return chain_(
    _,
    trace((a: A) => succeed(f(a)))
  )
}
