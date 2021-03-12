// tracing: off

import type { Clock } from "../Clock"
import { pipe } from "../Function"
import type { Has } from "../Has"
import { cachedInvalidate_ } from "./cachedInvalidate"
import type { Effect, IO, RIO } from "./effect"
import { map } from "./map"

/**
 * Returns an effect that, if evaluated, will return the cached result of
 * this effect. Cached results will expire after `timeToLive` duration.
 *
 * @dataFirst cached_
 */
export function cached(ttl: number, __trace?: string) {
  return <R, E, A>(fa: Effect<R, E, A>) => cached_(fa, ttl)
}

/**
 * Returns an effect that, if evaluated, will return the cached result of
 * this effect. Cached results will expire after `timeToLive` duration.
 */
export function cached_<R, E, A>(
  fa: Effect<R, E, A>,
  ttl: number,
  __trace?: string
): RIO<R & Has<Clock>, IO<E, A>> {
  return pipe(
    cachedInvalidate_(fa, ttl, __trace),
    map(([cachedEffect, _]) => cachedEffect)
  )
}
