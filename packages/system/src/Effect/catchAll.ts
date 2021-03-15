// tracing: off

import { traceAs } from "@effect-ts/tracing-utils"

import { succeed } from "./core"
import type { Effect } from "./effect"
import { fail } from "./fail"
import { foldM_ } from "./foldM"

/**
 * Recovers from all errors.
 *
 * @trace 1
 */
export function catchAll_<R2, E2, A2, R, E, A>(
  effect: Effect<R2, E2, A2>,
  f: (e: E2) => Effect<R, E, A>
) {
  return foldM_(effect, f, succeed)
}

/**
 * Recovers from all errors.
 *
 * @dataFirst catchAll_
 * @trace 0
 */
export function catchAll<R, E, E2, A>(f: (e: E2) => Effect<R, E, A>) {
  return <R2, A2>(effect: Effect<R2, E2, A2>) => catchAll_(effect, f)
}

/**
 * Recovers from specified error.
 *
 * @dataFirst catch_
 * @trace 2
 */
function _catch<N extends keyof E, K extends E[N] & string, E, R1, E1, A1>(
  tag: N,
  k: K,
  f: (e: Extract<E, { [n in N]: K }>) => Effect<R1, E1, A1>
) {
  return <R, A>(
    self: Effect<R, E, A>
  ): Effect<R & R1, Exclude<E, { [n in N]: K }> | E1, A | A1> =>
    catchAll_(self, (e) => {
      if (tag in e && e[tag] === k) {
        return f(e as any)
      }
      return fail(e as any)
    })
}

/**
 * Recovers from specified error.
 *
 * @trace 3
 */
export function catch_<N extends keyof E, K extends E[N] & string, E, R, A, R1, E1, A1>(
  self: Effect<R, E, A>,
  tag: N,
  k: K,
  f: (e: Extract<E, { [n in N]: K }>) => Effect<R1, E1, A1>
): Effect<R & R1, Exclude<E, { [n in N]: K }> | E1, A | A1> {
  return catchAll_(
    self,
    traceAs(f, (e) => {
      if (tag in e && e[tag] === k) {
        return f(e as any)
      }
      return fail(e as any)
    })
  )
}

/**
 * Recovers from specified error.
 *
 * @dataFirst catchTag_
 * @trace 1
 */
export function catchTag<
  K extends E["_tag"] & string,
  E extends { _tag: string },
  R1,
  E1,
  A1
>(k: K, f: (e: Extract<E, { _tag: K }>) => Effect<R1, E1, A1>) {
  return <R, A>(
    self: Effect<R, E, A>
  ): Effect<R & R1, Exclude<E, { _tag: K }> | E1, A | A1> => catchTag_(self, k, f)
}

/**
 * Recovers from specified error.
 *
 * @trace 2
 */
export function catchTag_<
  K extends E["_tag"] & string,
  E extends { _tag: string },
  R,
  A,
  R1,
  E1,
  A1
>(
  self: Effect<R, E, A>,
  k: K,
  f: (e: Extract<E, { _tag: K }>) => Effect<R1, E1, A1>
): Effect<R & R1, Exclude<E, { _tag: K }> | E1, A | A1> {
  return catchAll_(
    self,
    traceAs(f, (e) => {
      if ("_tag" in e && e["_tag"] === k) {
        return f(e as any)
      }
      return fail(e as any)
    })
  )
}

export { _catch as catch }
