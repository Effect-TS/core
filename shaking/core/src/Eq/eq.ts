/**
 * The `Eq` type class represents types which support decidable equality.
 *
 * Instances must satisfy the following laws:
 *
 * 1. Reflexivity: `E.equals(a, a) === true`
 * 2. Symmetry: `E.equals(a, b) === E.equals(b, a)`
 * 3. Transitivity: if `E.equals(a, b) === true` and `E.equals(b, c) === true`, then `E.equals(a, c) === true`
 */
import type { Eq } from "fp-ts/lib/Eq"

import type { Contravariant1 } from "../Base"
import type { Monoid } from "../Monoid"
import type { ReadonlyRecord } from "../Readonly/Record"

export type { Eq } from "fp-ts/lib/Eq"

export const contramap_: <A, B>(fa: Eq<A>, f: (b: B) => A) => Eq<B> = (fa, f) =>
  fromEquals((x, y) => fa.equals(f(x), f(y)))

export const contramap: <A, B>(f: (b: B) => A) => (fa: Eq<A>) => Eq<B> = (f) => (fa) =>
  contramap_(fa, f)

export const eqStrict: Eq<unknown> = {
  equals: strictEqual
}

export const eqBoolean: Eq<boolean> = eqStrict

export const eqNumber: Eq<number> = eqStrict

export const eqDate: Eq<Date> = contramap_(eqNumber, (date) => date.valueOf())

export const eqString: Eq<string> = eqStrict

export function fromEquals<A>(equals: (x: A, y: A) => boolean): Eq<A> {
  return {
    equals: (x, y) => x === y || equals(x, y)
  }
}

export function getMonoid<A>(): Monoid<Eq<A>> {
  return {
    concat: (x, y) => fromEquals((a, b) => x.equals(a, b) && y.equals(a, b)),
    empty: {
      equals: () => true
    }
  }
}

export function getStructEq<O extends ReadonlyRecord<string, any>>(
  eqs: {
    [K in keyof O]: Eq<O[K]>
  }
): Eq<O> {
  return fromEquals((x, y) => {
    for (const k in eqs) {
      if (!eqs[k].equals(x[k], y[k])) {
        return false
      }
    }
    return true
  })
}

/**
 * Given a tuple of `Eq`s returns a `Eq` for the tuple
 *
 * @example
 * import { getTupleEq, eqString, eqNumber, eqBoolean } from '@matechs/core/Eq'
 *
 * const E = getTupleEq(eqString, eqNumber, eqBoolean)
 * assert.strictEqual(E.equals(['a', 1, true], ['a', 1, true]), true)
 * assert.strictEqual(E.equals(['a', 1, true], ['b', 1, true]), false)
 * assert.strictEqual(E.equals(['a', 1, true], ['a', 2, true]), false)
 * assert.strictEqual(E.equals(['a', 1, true], ['a', 1, false]), false)
 */
export function getTupleEq<T extends ReadonlyArray<Eq<any>>>(
  ...eqs: T
): Eq<
  {
    [K in keyof T]: T[K] extends Eq<infer A> ? A : never
  }
> {
  return fromEquals((x, y) => eqs.every((E, i) => E.equals(x[i], y[i])))
}

/**
 * Use `eqStrict` instead
 */
export function strictEqual<A>(a: A, b: A): boolean {
  return a === b
}

export const URI = "Eq"

export type URI = typeof URI

export const eq: Contravariant1<URI> = {
  URI,
  contramap: contramap_
}

declare module "fp-ts/lib/HKT" {
  interface URItoKind<A> {
    readonly Eq: Eq<A>
  }
}
