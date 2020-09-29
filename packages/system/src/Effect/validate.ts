import * as A from "../Array"
import type * as NA from "../NonEmptyArray"
import type { Effect } from "./effect"
import type { ExecutionStrategy } from "./ExecutionStrategy"
import { validate_, validateExec_, validatePar_, validateParN_ } from "./validate_"

/**
 * Feeds elements of type `A` to `f` and accumulates all errors in error
 * channel or successes in success channel.
 *
 * This combinator is lossy meaning that if there are errors all successes
 * will be lost.
 */
export function validate<A, R, E, B>(f: (a: A) => Effect<R, E, B>) {
  return (as: Iterable<A>) => validate_(as, f)
}

/**
 * Feeds elements of type `A` to `f` and accumulates all errors in error
 * channel or successes in success channel.
 *
 * This combinator is lossy meaning that if there are errors all successes
 * will be lost.
 */
export function validatePar<A, R, E, B>(f: (a: A) => Effect<R, E, B>) {
  return (as: Iterable<A>) => validatePar_(as, f)
}

/**
 * Feeds elements of type `A` to `f` and accumulates all errors in error
 * channel or successes in success channel.
 *
 * This combinator is lossy meaning that if there are errors all successes
 * will be lost.
 */
export function validateParN(n: number) {
  return <A, R, E, B>(f: (a: A) => Effect<R, E, B>) => (as: Iterable<A>) =>
    validateParN_(n)(as, f)
}

/**
 * Feeds elements of type `A` to `f` and accumulates all errors in error
 * channel or successes in success channel.
 *
 * This combinator is lossy meaning that if there are errors all successes
 * will be lost.
 */
export function validateExec(
  es: ExecutionStrategy
): <R, E, A, B>(
  f: (a: A) => Effect<R, E, B>
) => (as: Iterable<A>) => Effect<R, NA.NonEmptyArray<E>, A.Array<B>> {
  return (f) => (as) => validateExec_(es, as, f)
}
