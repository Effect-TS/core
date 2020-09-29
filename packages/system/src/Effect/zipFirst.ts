import { chain_ } from "./core"
import type { Effect } from "./effect"
import { map_ } from "./map_"

/**
 * Sequentially zips this effect with the specified effect,
 * ignoring result of the second
 */
export function zipFirst<R2, E2, A2>(b: Effect<R2, E2, A2>) {
  return <R, E, A>(a: Effect<R, E, A>): Effect<R & R2, E | E2, A> =>
    chain_(a, (ra) => map_(b, (_) => ra))
}
