import type { Cause } from "../Cause/cause"
import { foldCauseM_, succeed } from "./core"
import type { Effect, RIO } from "./effect"

/**
 * A more powerful version of `fold` that allows recovering from any kind of failure except interruptions.
 */
export function foldCause_<R, E, A, A2, A3>(
  value: Effect<R, E, A>,
  failure: (cause: Cause<E>) => A2,
  success: (a: A) => A3
): RIO<R, A2 | A3> {
  return foldCauseM_(
    value,
    (c) => succeed(failure(c)),
    (x) => succeed(success(x))
  )
}
