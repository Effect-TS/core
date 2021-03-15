// tracing: off

import * as A from "../Array"
import { pipe } from "../Function"
import * as I from "../Iterable"
import * as O from "../Option"
import * as core from "./core"
import type { Effect } from "./effect"
import * as forEach from "./excl-forEach"
import * as map from "./map"
import { traceAfter_ } from "./traceAfter"
import * as zipWith from "./zipWith"

/**
 * Filters the collection using the specified effectual predicate.
 *
 * @dataFirst filter_
 */
export function filter<A, R, E>(f: (a: A) => Effect<R, E, boolean>, __trace?: string) {
  return (as: Iterable<A>) => filter_(as, f, __trace)
}

/**
 * Filters the collection using the specified effectual predicate.
 */
export function filter_<A, R, E>(
  as: Iterable<A>,
  f: (a: A) => Effect<R, E, boolean>,
  __trace?: string
): Effect<R, E, readonly A[]> {
  return traceAfter_(
    I.reduce_(as, <Effect<R, E, A[]>>core.effectTotal(() => []), (io, a) =>
      zipWith.zipWith_(
        io,
        core.suspend(() => f(a)),
        (as_, p) => {
          if (p) {
            as_.push(a)
          }
          return as_
        }
      )
    ),
    __trace
  )
}

/**
 * Filters the collection in parallel using the specified effectual predicate.
 * See `filter` for a sequential version of it.
 */
export function filterPar_<A, R, E>(
  as: Iterable<A>,
  f: (a: A) => Effect<R, E, boolean>,
  __trace?: string
) {
  return pipe(
    as,
    forEach.forEachPar((a) => map.map_(f(a), (b) => (b ? O.some(a) : O.none)), __trace),
    map.map(A.compact)
  )
}

/**
 * Filters the collection in parallel using the specified effectual predicate.
 * See `filter` for a sequential version of it.
 *
 * @dataFirst filterPar_
 */
export function filterPar<A, R, E>(
  f: (a: A) => Effect<R, E, boolean>,
  __trace?: string
) {
  return (as: Iterable<A>) => filterPar_(as, f, __trace)
}

/**
 * Filters the collection in parallel using the specified effectual predicate.
 * See `filter` for a sequential version of it.
 *
 * This method will use up to `n` fibers.
 */
export function filterParN_<A, R, E>(
  as: Iterable<A>,
  n: number,
  f: (a: A) => Effect<R, E, boolean>,
  __trace?: string
) {
  return pipe(
    as,
    forEach.forEachParN(
      n,
      (a) => map.map_(f(a), (b) => (b ? O.some(a) : O.none)),
      __trace
    ),
    map.map(A.compact)
  )
}

/**
 * Filters the collection in parallel using the specified effectual predicate.
 * See `filter` for a sequential version of it.
 *
 * This method will use up to `n` fibers.
 *
 * @dataFirst filterParN_
 */
export function filterParN<A, R, E>(
  n: number,
  f: (a: A) => Effect<R, E, boolean>,
  __trace?: string
) {
  return (as: Iterable<A>) => filterParN_(as, n, f, __trace)
}

/**
 * Filters the collection using the specified effectual predicate, removing
 * all elements that satisfy the predicate.
 *
 * @dataFirst filterNot_
 */
export function filterNot<A, R, E>(
  f: (a: A) => Effect<R, E, boolean>,
  __trace?: string
) {
  return (as: Iterable<A>) => filterNot_(as, f, __trace)
}

/**
 * Filters the collection using the specified effectual predicate, removing
 * all elements that satisfy the predicate.
 */
export function filterNot_<A, R, E>(
  as: Iterable<A>,
  f: (a: A) => Effect<R, E, boolean>,
  __trace?: string
) {
  return filter_(as, (x) => map.map_(f(x), (b) => !b), __trace)
}

/**
 * Filters the collection in parallel using the specified effectual predicate.
 * See `filterNot` for a sequential version of it.
 */
export function filterNotPar_<A, R, E>(
  as: Iterable<A>,
  f: (a: A) => Effect<R, E, boolean>,
  __trace?: string
) {
  return filterPar_(as, (x) => map.map_(f(x), (b) => !b), __trace)
}

/**
 * Filters the collection in parallel using the specified effectual predicate.
 * See `filterNot` for a sequential version of it.
 *
 * @dataFirst filterNotPar_
 */
export function filterNotPar<A, R, E>(
  f: (a: A) => Effect<R, E, boolean>,
  __trace?: string
) {
  return (as: Iterable<A>) => filterNotPar_(as, f, __trace)
}

/**
 * Filters the collection in parallel using the specified effectual predicate.
 * See `filterNot` for a sequential version of it.
 */
export function filterNotParN_<A, R, E>(
  as: Iterable<A>,
  n: number,
  f: (a: A) => Effect<R, E, boolean>,
  __trace?: string
) {
  return filterParN_(as, n, (x) => map.map_(f(x), (b) => !b), __trace)
}

/**
 * Filters the collection in parallel using the specified effectual predicate.
 * See `filterNot` for a sequential version of it.
 *
 * @dataFirst filterNotParN_
 */
export function filterNotParN<R, E, A>(
  n: number,
  f: (a: A) => Effect<R, E, boolean>,
  __trace?: string
) {
  return (as: Iterable<A>) => filterNotParN_(as, n, f, __trace)
}
