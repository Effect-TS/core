import type { Equal } from "../Equal"
import { Ordering } from "../Ordering"

/**
 * `Ord[A]` provides implicit evidence that values of type `A` have a total
 * ordering.
 */
export interface Ord<A> extends Equal<A> {
  readonly compare: (y: A) => (x: A) => Ordering
}

export const OrdURI = "Ord"
export type OrdURI = typeof OrdURI

declare module "../HKT" {
  interface URItoKind<
    TL0,
    TL1,
    TL2,
    TL3,
    K,
    NK extends string,
    SI,
    SO,
    X,
    I,
    S,
    Env,
    Err,
    Out
  > {
    [OrdURI]: Ord<Out>
  }
}

/**
 * Creates Ord[A] from a compare function
 */
export function fromCompare<A>(compare: (y: A) => (x: A) => Ordering): Ord<A> {
  return {
    equals: (y) => (x) => Ordering.unwrap(compare(y)(x)) === "eq",
    compare
  }
}

/**
 * Creates Ord[A] from a compare function
 */
export function fromCompare_<A>(compare: (x: A, y: A) => Ordering): Ord<A> {
  return {
    equals: (y) => (x) => Ordering.unwrap(compare(x, y)) === "eq",
    compare: (y) => (x) => compare(x, y)
  }
}

/**
 * Creates Ord[A] from equals & compare functions
 */
export function makeOrd<A>(
  equals: (y: A) => (x: A) => boolean,
  compare: (y: A) => (x: A) => Ordering
): Ord<A> {
  return {
    compare,
    equals
  }
}
