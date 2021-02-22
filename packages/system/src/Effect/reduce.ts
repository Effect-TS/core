import * as A from "../Array/core"
import { chain_, succeed } from "./core"
import type { Effect } from "./effect"

/**
 * Folds an Iterable[A] using an effectual function f, working sequentially from left to right.
 */
export function reduce_<A, Z, R, E>(
  i: Iterable<A>,
  zero: Z,
  f: (z: Z, a: A) => Effect<R, E, Z>
): Effect<R, E, Z> {
  return A.reduce_(Array.from(i), succeed(zero) as Effect<R, E, Z>, (acc, el) =>
    chain_(acc, (a) => f(a, el))
  )
}

/**
 * Folds an Iterable[A] using an effectual function f, working sequentially from left to right.
 */
export function reduce<Z>(zero: Z) {
  return <R, E, A>(f: (z: Z, a: A) => Effect<R, E, Z>) => (i: Iterable<A>) =>
    reduce_(i, zero, f)
}

/**
 * Folds an Iterable[A] using an effectual function f, working sequentially from left to right.
 */
export function reduceRight_<A, Z, R, E>(
  i: Iterable<A>,
  zero: Z,
  f: (a: A, z: Z) => Effect<R, E, Z>
): Effect<R, E, Z> {
  return A.reduceRight_(Array.from(i), succeed(zero) as Effect<R, E, Z>, (el, acc) =>
    chain_(acc, (a) => f(el, a))
  )
}

/**
 * Folds an Iterable[A] using an effectual function f, working sequentially from left to right.
 */
export function reduceRight<Z>(zero: Z) {
  return <R, E, A>(f: (a: A, z: Z) => Effect<R, E, Z>) => (i: Iterable<A>) =>
    reduceRight_(i, zero, f)
}
