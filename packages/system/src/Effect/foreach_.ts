import * as IT from "../Iterable"
import { succeed, suspend } from "./core"
import type { Effect } from "./effect"
import { zipWith_ } from "./zipWith_"

/**
 * Applies the function `f` to each element of the `Iterable<A>` and
 * returns the results in a new `readonly B[]`.
 *
 * For a parallel version of this method, see `foreachPar`.
 * If you do not need the results, see `foreachUnit` for a more efficient implementation.
 */
export const foreach_ = <A, S, R, E, B>(
  as: Iterable<A>,
  f: (a: A) => Effect<S, R, E, B>
) =>
  IT.reduce_(as, succeed([]) as Effect<S, R, E, readonly B[]>, (b, a) =>
    zipWith_(
      b,
      suspend(() => f(a)),
      (acc, r) => [...acc, r]
    )
  )
