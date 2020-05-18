import type { Ordering } from "fp-ts/lib/Ordering"

import type { Contravariant1 } from "../Base"
import type { Eq } from "../Eq"
import type { Monoid } from "../Monoid"
import type { Semigroup } from "../Semigroup"

import { monoidOrdering } from "./monoidOrdering"

export type { Ordering } from "fp-ts/lib/Ordering"
export type { Bounded } from "fp-ts/lib/Bounded"

/**
 * Test whether a value is between a minimum and a maximum (inclusive)
 */
export function between<A>(O: Ord<A>): (low: A, hi: A) => (x: A) => boolean {
  const lessThanO = lt(O)
  const greaterThanO = gt(O)
  return (low, hi) => (x) => (lessThanO(x, low) || greaterThanO(x, hi) ? false : true)
}

/**
 * Clamp a value between a minimum and a maximum
 */
export function clamp<A>(O: Ord<A>): (low: A, hi: A) => (x: A) => A {
  const minO = min(O)
  const maxO = max(O)
  return (low, hi) => (x) => maxO(minO(x, hi), low)
}

export const contramap: <A, B>(f: (b: B) => A) => (fa: Ord<A>) => Ord<B> = (f) => (
  fa
) => contramap_(fa, f)

export const contramap_: <A, B>(fa: Ord<A>, f: (b: B) => A) => Ord<B> = (fa, f) =>
  fromCompare((x, y) => fa.compare(f(x), f(y)))

export function fromCompare<A>(compare: (x: A, y: A) => Ordering): Ord<A> {
  const optimizedCompare = (x: A, y: A): Ordering => (x === y ? 0 : compare(x, y))
  return {
    equals: (x, y) => optimizedCompare(x, y) === 0,
    compare: optimizedCompare
  }
}

/**
 * Test whether one value is _non-strictly greater than_ another
 */
export function geq<A>(O: Ord<A>): (x: A, y: A) => boolean {
  return (x, y) => O.compare(x, y) !== -1
}

export function getDualOrd<A>(O: Ord<A>): Ord<A> {
  return fromCompare((x, y) => O.compare(y, x))
}

/**
 * Returns a `Monoid` such that:
 *
 * - its `concat(ord1, ord2)` operation will order first by `ord1`, and then by `ord2`
 * - its `empty` value is an `Ord` that always considers compared elements equal
 *
 * @example
 * import { sort } from '@matechs/core/Array'
 * import { contramap, getDualOrd, getMonoid, ordBoolean, ordNumber, ordString } from '@matechs/core/Ord'
 * import { pipe } from '@matechs/core/Pipe'
 * import { fold } from '@matechs/core/Monoid'
 *
 * interface User {
 *   id: number
 *   name: string
 *   age: number
 *   rememberMe: boolean
 * }
 *
 * const byName = pipe(
 *   ordString,
 *   contramap((p: User) => p.name)
 * )
 *
 * const byAge = pipe(
 *   ordNumber,
 *   contramap((p: User) => p.age)
 * )
 *
 * const byRememberMe = pipe(
 *   ordBoolean,
 *   contramap((p: User) => p.rememberMe)
 * )
 *
 * const M = getMonoid<User>()
 *
 * const users: Array<User> = [
 *   { id: 1, name: 'Guido', age: 47, rememberMe: false },
 *   { id: 2, name: 'Guido', age: 46, rememberMe: true },
 *   { id: 3, name: 'Giulio', age: 44, rememberMe: false },
 *   { id: 4, name: 'Giulio', age: 44, rememberMe: true }
 * ]
 *
 * // sort by name, then by age, then by `rememberMe`
 * const O1 = fold(M)([byName, byAge, byRememberMe])
 * assert.deepStrictEqual(sort(O1)(users), [
 *   { id: 3, name: 'Giulio', age: 44, rememberMe: false },
 *   { id: 4, name: 'Giulio', age: 44, rememberMe: true },
 *   { id: 2, name: 'Guido', age: 46, rememberMe: true },
 *   { id: 1, name: 'Guido', age: 47, rememberMe: false }
 * ])
 *
 * // now `rememberMe = true` first, then by name, then by age
 * const O2 = fold(M)([getDualOrd(byRememberMe), byName, byAge])
 * assert.deepStrictEqual(sort(O2)(users), [
 *   { id: 4, name: 'Giulio', age: 44, rememberMe: true },
 *   { id: 2, name: 'Guido', age: 46, rememberMe: true },
 *   { id: 3, name: 'Giulio', age: 44, rememberMe: false },
 *   { id: 1, name: 'Guido', age: 47, rememberMe: false }
 * ])
 */
export function getMonoid<A = never>(): Monoid<Ord<A>> {
  return {
    // tslint:disable-next-line: deprecation
    concat: getSemigroup<any>().concat,
    empty: fromCompare(() => 0)
  }
}

/**
 * Use `getMonoid` instead
 */
export function getSemigroup<A = never>(): Semigroup<Ord<A>> {
  return {
    concat: (x, y) =>
      fromCompare((a, b) => monoidOrdering.concat(x.compare(a, b), y.compare(a, b)))
  }
}

/**
 * Given a tuple of `Ord`s returns an `Ord` for the tuple
 *
 * @example
 * import { getTupleOrd, ordString, ordNumber, ordBoolean } from '@matechs/core/Ord'
 *
 * const O = getTupleOrd(ordString, ordNumber, ordBoolean)
 * assert.strictEqual(O.compare(['a', 1, true], ['b', 2, true]), -1)
 * assert.strictEqual(O.compare(['a', 1, true], ['a', 2, true]), -1)
 * assert.strictEqual(O.compare(['a', 1, true], ['a', 1, false]), 1)
 */
export function getTupleOrd<T extends ReadonlyArray<Ord<any>>>(
  ...ords: T
): Ord<
  {
    [K in keyof T]: T[K] extends Ord<infer A> ? A : never
  }
> {
  const len = ords.length
  return fromCompare((x, y) => {
    let i = 0
    for (; i < len - 1; i++) {
      const r = ords[i].compare(x[i], y[i])
      if (r !== 0) {
        return r
      }
    }
    return ords[i].compare(x[i], y[i])
  })
}

/**
 * Test whether one value is _strictly greater than_ another
 */
export function gt<A>(O: Ord<A>): (x: A, y: A) => boolean {
  return (x, y) => O.compare(x, y) === 1
}

export function invert(O: Ordering): Ordering {
  switch (O) {
    case -1:
      return 1
    case 1:
      return -1
    default:
      return 0
  }
}

/**
 * Test whether one value is _non-strictly less than_ another
 */
export function leq<A>(O: Ord<A>): (x: A, y: A) => boolean {
  return (x, y) => O.compare(x, y) !== 1
}

/**
 * Test whether one value is _strictly less than_ another
 */
export function lt<A>(O: Ord<A>): (x: A, y: A) => boolean {
  return (x, y) => O.compare(x, y) === -1
}

/**
 * Take the maximum of two values. If they are considered equal, the first argument is chosen
 */
export function max<A>(O: Ord<A>): (x: A, y: A) => A {
  return (x, y) => (O.compare(x, y) === -1 ? y : x)
}

/**
 * Take the minimum of two values. If they are considered equal, the first argument is chosen
 */
export function min<A>(O: Ord<A>): (x: A, y: A) => A {
  return (x, y) => (O.compare(x, y) === 1 ? y : x)
}

export interface Ord<A> extends Eq<A> {
  readonly compare: (x: A, y: A) => Ordering
}

export function sign(n: number): Ordering {
  return n <= -1 ? -1 : n >= 1 ? 1 : 0
}

export const URI = "Ord"

export type URI = typeof URI

export const ord: Contravariant1<URI> = {
  URI,
  contramap: contramap_
}
