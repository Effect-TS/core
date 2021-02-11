import type * as A from "@effect-ts/system/Array"
import type * as E from "@effect-ts/system/Either"

import type { Equal } from "./definition"

/**
 * Constructs an `Equal[A]` from a function. The instance will be optimized
 * to first compare the values for reference equality and then compare the
 * values for value equality.
 */
export function makeEqual<A>(f: (y: A) => (x: A) => boolean): Equal<A> {
  return {
    equals: f
  }
}

/**
 * Equality for `Any` values. Note that since values of type `Any` contain
 * no information, all values of type `Any` can be treated as equal to each
 * other.
 */
export const anyEqual: Equal<unknown> = makeEqual(() => () => true)

/**
 * Equality for `Nothing` values. Note that since there are not values of
 * type `Nothing` the `equals` method of this instance can never be called
 * but it can be useful in deriving instances for more complex types.
 */
export const nothingEqual: Equal<never> = makeEqual(() => () => false)

/**
 * Constructs an `Equal[(A, B)]` given an `Equal[A]` and `Equal[B]` by first
 * comparing the `A` values for equality and then comparing the `B` values
 * for equality, if necessary.
 */
export function both<B>(fb: Equal<B>): <A>(fa: Equal<A>) => Equal<readonly [A, B]> {
  return (fa) =>
    makeEqual(([y0, y1]) => ([x0, x1]) => fa.equals(y0)(x0) && fb.equals(y1)(x1))
}

/**
 * Constructs an `Equal[Either[A, B]]` given an `Equal[A]` and an
 * `Equal[B]`. The instance will compare the `Either[A, B]` values and if
 * both are `Right` or `Left` compare them for equality.
 */
export function orElseEither<B>(
  fb: () => Equal<B>
): <A>(fa: Equal<A>) => Equal<E.Either<A, B>> {
  return (fa) =>
    makeEqual((ey) => (ex) =>
      ex._tag === "Left" && ey._tag === "Left"
        ? fa.equals(ey.left)(ex.left)
        : ex._tag === "Right" && ey._tag === "Right"
        ? fb().equals(ey.right)(ex.right)
        : false
    )
}

/**
 * Constructs an `Equal[B]` given an `Equal[A]` and a function `f` to
 * transform a `B` value into an `A` value. The instance will convert each
 * `B` value into an `A` and the compare the `A` values for equality.
 */
export function contramap<A, B>(f: (a: B) => A): (fa: Equal<A>) => Equal<B> {
  return (fa) => makeEqual((y) => (x) => fa.equals(f(y))(f(x)))
}

/**
 * Constructs an `Equal[A]` that uses the default notion of equality
 * embodied in the implementation of `equals` for values of type `A`.
 */
export function strict<A>() {
  return makeEqual<A>((y) => (x) => x === y)
}

/**
 * Equality for `number` values.
 */
export const number = strict<number>()

/**
 * Equality for `string` values.
 */
export const string = strict<string>()

/**
 * Equality for `symbol` values.
 */
export const symbol = strict<symbol>()

/**
 * Derives an `Equal[Array[A]]` given an `Equal[A]`.
 */
export function array<A>(EqA: Equal<A>): Equal<A.Array<A>> {
  return {
    equals: (y) => (x) => {
      if (x.length === y.length) {
        for (let i = 0; i < x.length; i++) {
          if (!EqA.equals(y[i])(x[i])) {
            return false
          }
        }
        return true
      }
      return false
    }
  }
}

/**
 * Given a tuple of `Equal`s returns a `Equal` for the tuple
 */
export function tuple<T extends ReadonlyArray<Equal<any>>>(
  ...eqs: T
): Equal<
  {
    [K in keyof T]: T[K] extends Equal<infer A> ? A : never
  }
> {
  return makeEqual((y) => (x) => eqs.every((E, i) => E.equals(y[i])(x[i])))
}

/**
 * Given a struct of `Equal`s returns a `Equal` for the struct
 */
export function struct<O extends Record<string, any>>(
  eqs: {
    [K in keyof O]: Equal<O[K]>
  }
): Equal<O> {
  return makeEqual((y) => (x) => {
    for (const k in eqs) {
      if (!eqs[k].equals(y[k])(x[k])) {
        return false
      }
    }
    return true
  })
}
