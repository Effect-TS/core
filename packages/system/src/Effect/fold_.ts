import { succeed } from "./core"
import type { Effect } from "./effect"
import { foldM_ } from "./foldM_"

/**
 * Folds over the failure value or the success value to yield an effect that
 * does not fail, but succeeds with the value returned by the left or right
 * function passed to `fold`.
 */
export function fold_<R, E, A, A2, A3>(
  value: Effect<R, E, A>,
  failure: (failure: E) => A2,
  success: (a: A) => A3
): Effect<R, never, A2 | A3> {
  return foldM_(
    value,
    (e) => succeed(failure(e)),
    (a) => succeed(success(a))
  )
}
