// tracing: off

import * as A from "../Array"
import * as NA from "../NonEmptyArray"
import * as O from "../Option"
import type { Effect } from "./effect"
import { map_ } from "./map"
import { mergeAllPar_, mergeAllParN_ } from "./mergeAll"
import { zipWith_ } from "./zipWith"

/**
 * Reduces an `Iterable[IO]` to a single `IO`, working sequentially.
 */
export function reduceAll_<R, E, A>(
  as: NA.NonEmptyArray<Effect<R, E, A>>,
  f: (acc: A, a: A) => A
): Effect<R, E, A> {
  return A.reduce_(NA.tail(as), NA.head(as), (acc, a) => zipWith_(acc, a, f))
}

/**
 * Reduces an `Iterable[IO]` to a single `IO`, working sequentially.
 *
 * @dataFirst reduceAll_
 */
export function reduceAll<A>(f: (acc: A, a: A) => A) {
  return <R, E>(as: NA.NonEmptyArray<Effect<R, E, A>>) => reduceAll_(as, f)
}

/**
 * Reduces an `Iterable[IO]` to a single `IO`, working in parallel.
 */
export function reduceAllPar_<R, E, A>(
  as: NA.NonEmptyArray<Effect<R, E, A>>,
  f: (acc: A, a: A) => A
): Effect<R, E, A> {
  return map_(
    mergeAllPar_(as, <O.Option<A>>O.none, (acc, elem) =>
      O.some(
        O.fold_(
          acc,
          () => elem,
          (a) => f(a, elem)
        )
      )
    ),
    O.getOrElse(() => {
      throw new Error("Bug")
    })
  )
}

/**
 * Reduces an `Iterable[IO]` to a single `IO`, working in parallel.
 *
 * @dataFirst reduceAllPar_
 */
export function reduceAllPar<A>(f: (acc: A, a: A) => A) {
  return <R, E>(as: NA.NonEmptyArray<Effect<R, E, A>>) => reduceAllPar_(as, f)
}

/**
 * Reduces an `Iterable[IO]` to a single `IO`, working in up to `n` fibers in parallel.
 */
export function reduceAllParN_<R, E, A>(
  as: NA.NonEmptyArray<Effect<R, E, A>>,
  n: number,
  f: (acc: A, a: A) => A
): Effect<R, E, A> {
  return map_(
    mergeAllParN_(as, n, <O.Option<A>>O.none, (acc, elem) =>
      O.some(
        O.fold_(
          acc,
          () => elem,
          (a) => f(a, elem)
        )
      )
    ),
    O.getOrElse(() => {
      throw new Error("Bug")
    })
  )
}

/**
 * Reduces an `Iterable[IO]` to a single `IO`, working in up to `n` fibers in parallel.
 *
 * @dataFirst reduceAllParN_
 */
export function reduceAllParN<A>(n: number, f: (acc: A, a: A) => A) {
  return <R, E>(as: NA.NonEmptyArray<Effect<R, E, A>>): Effect<R, E, A> =>
    reduceAllParN_(as, n, f)
}
