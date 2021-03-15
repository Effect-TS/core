// tracing: off

import { traceAs } from "@effect-ts/tracing-utils"

import * as A from "../Array"
import type { Option } from "../Option"
import type { Effect } from "./effect"
import { forEach_, forEachPar_, forEachParN_ } from "./excl-forEach"
import { map_ } from "./map"
import { optional } from "./optional"

/**
 * Evaluate each effect in the structure from left to right, collecting the
 * the successful values and discarding the empty cases. For a parallel version, see `collectPar`.
 *
 * @dataFirst collect_
 * @trace 0
 */
export function collect<A, R, E, B>(f: (a: A) => Effect<R, Option<E>, B>) {
  return (self: Iterable<A>): Effect<R, E, readonly B[]> => collect_(self, f)
}

/**
 * Evaluate each effect in the structure from left to right, collecting the
 * the successful values and discarding the empty cases. For a parallel version, see `collectPar`.
 *
 * @trace 1
 */
export function collect_<A, R, E, B>(
  self: Iterable<A>,
  f: (a: A) => Effect<R, Option<E>, B>
): Effect<R, E, readonly B[]> {
  return map_(
    forEach_(
      self,
      traceAs(f, (a) => optional(f(a)))
    ),
    A.compact
  )
}

/**
 * Evaluate each effect in the structure in parallel, collecting the
 * the successful values and discarding the empty cases.
 *
 * @dataFirst collectPar_
 * @trace 0
 */
export function collectPar<A, R, E, B>(f: (a: A) => Effect<R, Option<E>, B>) {
  return (self: Iterable<A>): Effect<R, E, readonly B[]> => collectPar_(self, f)
}

/**
 * Evaluate each effect in the structure in parallel, collecting the
 * the successful values and discarding the empty cases.
 *
 * @trace 1
 */
export function collectPar_<A, R, E, B>(
  self: Iterable<A>,
  f: (a: A) => Effect<R, Option<E>, B>
): Effect<R, E, readonly B[]> {
  return map_(
    forEachPar_(
      self,
      traceAs(f, (a) => optional(f(a)))
    ),
    A.compact
  )
}

/**
 * Evaluate each effect in the structure in parallel, collecting the
 * the successful values and discarding the empty cases.
 *
 * Unlike `collectPar`, this method will use at most up to `n` fibers.
 *
 * @trace 2
 */
export function collectParN_<A, R, E, B>(
  self: Iterable<A>,
  n: number,
  f: (a: A) => Effect<R, Option<E>, B>
): Effect<R, E, readonly B[]> {
  return map_(
    forEachParN_(
      self,
      n,
      traceAs(f, (a) => optional(f(a)))
    ),
    A.compact
  )
}

/**
 * Evaluate each effect in the structure in parallel, collecting the
 * the successful values and discarding the empty cases.
 *
 * Unlike `collectPar`, this method will use at most up to `n` fibers.
 *
 * @dataFirst collectParN_
 * @trace 1
 */
export function collectParN<A, R, E, B>(
  n: number,
  f: (a: A) => Effect<R, Option<E>, B>
): (self: Iterable<A>) => Effect<R, E, readonly B[]> {
  return (self) => collectParN_(self, n, f)
}
