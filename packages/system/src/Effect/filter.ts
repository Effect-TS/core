// tracing: off

import { traceAs } from "@effect-ts/tracing-utils"

import * as A from "../Array"
import { pipe } from "../Function"
import * as I from "../Iterable"
import * as O from "../Option"
import * as core from "./core"
import type { Effect } from "./effect"
import * as forEach from "./excl-forEach"
import * as map from "./map"
import * as zipWith from "./zipWith"

/**
 * Filters the collection using the specified effectual predicate.
 *
 * @dataFirst filter_
 * @trace 0
 */
export function filter<A, R, E>(f: (a: A) => Effect<R, E, boolean>) {
  return (as: Iterable<A>) => filter_(as, f)
}

/**
 * Filters the collection using the specified effectual predicate.
 *
 * @trace 1
 */
export function filter_<A, R, E>(
  as: Iterable<A>,
  f: (a: A) => Effect<R, E, boolean>
): Effect<R, E, readonly A[]> {
  return I.reduce_(as, <Effect<R, E, A[]>>core.effectTotal(() => []), (io, a) =>
    zipWith.zipWith_(io, core.suspend(traceAs(f, () => f(a))), (as_, p) => {
      if (p) {
        as_.push(a)
      }
      return as_
    })
  )
}

/**
 * Filters the collection in parallel using the specified effectual predicate.
 * See `filter` for a sequential version of it.
 *
 * @trace 1
 */
export function filterPar_<A, R, E>(
  as: Iterable<A>,
  f: (a: A) => Effect<R, E, boolean>
) {
  return pipe(
    as,
    forEach.forEachPar(
      traceAs(f, (a) => map.map_(f(a), (b) => (b ? O.some(a) : O.none)))
    ),
    map.map(A.compact)
  )
}

/**
 * Filters the collection in parallel using the specified effectual predicate.
 * See `filter` for a sequential version of it.
 *
 * @dataFirst filterPar_
 * @trace 0
 */
export function filterPar<A, R, E>(f: (a: A) => Effect<R, E, boolean>) {
  return (as: Iterable<A>) => filterPar_(as, f)
}

/**
 * Filters the collection in parallel using the specified effectual predicate.
 * See `filter` for a sequential version of it.
 *
 * This method will use up to `n` fibers.
 *
 * @trace 2
 */
export function filterParN_<A, R, E>(
  as: Iterable<A>,
  n: number,
  f: (a: A) => Effect<R, E, boolean>
) {
  return pipe(
    as,
    forEach.forEachParN(
      n,
      traceAs(f, (a) => map.map_(f(a), (b) => (b ? O.some(a) : O.none)))
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
 * @trace 1
 */
export function filterParN<A, R, E>(n: number, f: (a: A) => Effect<R, E, boolean>) {
  return (as: Iterable<A>) => filterParN_(as, n, f)
}

/**
 * Filters the collection using the specified effectual predicate, removing
 * all elements that satisfy the predicate.
 *
 * @dataFirst filterNot_
 * @trace 0
 */
export function filterNot<A, R, E>(f: (a: A) => Effect<R, E, boolean>) {
  return (as: Iterable<A>) => filterNot_(as, f)
}

/**
 * Filters the collection using the specified effectual predicate, removing
 * all elements that satisfy the predicate.
 *
 * @trace 1
 */
export function filterNot_<A, R, E>(
  as: Iterable<A>,
  f: (a: A) => Effect<R, E, boolean>
) {
  return filter_(
    as,
    traceAs(f, (x) => map.map_(f(x), (b) => !b))
  )
}

/**
 * Filters the collection in parallel using the specified effectual predicate.
 * See `filterNot` for a sequential version of it.
 *
 * @trace 1
 */
export function filterNotPar_<A, R, E>(
  as: Iterable<A>,
  f: (a: A) => Effect<R, E, boolean>
) {
  return filterPar_(
    as,
    traceAs(f, (x) => map.map_(f(x), (b) => !b))
  )
}

/**
 * Filters the collection in parallel using the specified effectual predicate.
 * See `filterNot` for a sequential version of it.
 *
 * @dataFirst filterNotPar_
 * @trace 0
 */
export function filterNotPar<A, R, E>(f: (a: A) => Effect<R, E, boolean>) {
  return (as: Iterable<A>) => filterNotPar_(as, f)
}

/**
 * Filters the collection in parallel using the specified effectual predicate.
 * See `filterNot` for a sequential version of it.
 *
 * @trace 2
 */
export function filterNotParN_<A, R, E>(
  as: Iterable<A>,
  n: number,
  f: (a: A) => Effect<R, E, boolean>
) {
  return filterParN_(
    as,
    n,
    traceAs(f, (x) => map.map_(f(x), (b) => !b))
  )
}

/**
 * Filters the collection in parallel using the specified effectual predicate.
 * See `filterNot` for a sequential version of it.
 *
 * @dataFirst filterNotParN_
 * @trace 1
 */
export function filterNotParN<R, E, A>(n: number, f: (a: A) => Effect<R, E, boolean>) {
  return (as: Iterable<A>) => filterNotParN_(as, n, f)
}
