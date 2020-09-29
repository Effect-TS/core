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
export function foreach_<A, R, E, B>(as: Iterable<A>, f: (a: A) => Effect<R, E, B>) {
  return IT.reduce_(as, succeed([]) as Effect<R, E, readonly B[]>, (b, a) =>
    zipWith_(
      b,
      suspend(() => f(a)),
      (acc, r) => [...acc, r]
    )
  )
}
