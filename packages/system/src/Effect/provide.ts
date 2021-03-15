// tracing: off

import type { Effect } from "./effect"
import { provideSome_ } from "./provideSome"

/**
 * Provides some of the environment required to run this effect,
 * leaving the remainder `R0` and combining it automatically using spread.
 */
export function provide<R>(r: R, __trace?: string) {
  return <E, A, R0>(next: Effect<R & R0, E, A>): Effect<R0, E, A> =>
    provideSome_(next, (r0: R0) => ({ ...r0, ...r }), __trace)
}
