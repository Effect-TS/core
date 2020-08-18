import { Associative } from "../Associative"
import { Derive } from "../Derive"
import { URIS } from "../HKT"

export const IdentityURI = "Identity"
export type IdentityURI = typeof IdentityURI

/**
 * Equivalent to a Monoid
 */
export interface Identity<A> extends Associative<A> {
  readonly identity: A
}

declare module "../HKT" {
  interface URItoKind<N extends string, K, SI, SO, X, I, S, R, E, A> {
    [IdentityURI]: Identity<A>
  }
}

export function makeIdentity<A>(identity: A, op: (y: A) => (x: A) => A): Identity<A> {
  return {
    combine: op,
    identity
  }
}

export function deriveIdentity<F extends URIS, A>(
  D: Derive<F, IdentityURI>,
  I: Identity<A>
) {
  return D.derive(I)
}
