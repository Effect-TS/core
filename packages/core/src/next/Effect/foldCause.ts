import { Cause } from "../Cause/cause"

import { Effect } from "./effect"
import { foldCauseM_ } from "./foldCauseM_"
import { succeed } from "./succeed"

/**
 * A more powerful version of `fold` that allows recovering from any kind of failure except interruptions.
 */
export const foldCause = <E, A, A2, A3>(
  failure: (cause: Cause<E>) => A2,
  success: (a: A) => A3
) => <S, R>(value: Effect<S, R, E, A>): Effect<S, R, never, A2 | A3> =>
  foldCauseM_(
    value,
    (c) => succeed(failure(c)),
    (x) => succeed(success(x))
  )
