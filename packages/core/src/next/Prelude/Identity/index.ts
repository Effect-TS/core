import { Associative } from "../Associative"
import { Derive11 } from "../abstract/Derive"
import { Kind, URIS } from "../abstract/HKT"

export const URI = "Identity"
export type URI = typeof URI

export interface Identity<A> extends Associative<A> {
  readonly identity: A
}

declare module "../abstract/HKT" {
  interface URItoKind<Out> {
    [URI]: Identity<Out>
  }
}

export function makeIdentity<A>(identity: A, op: (y: A) => (x: A) => A): Identity<A> {
  return {
    combine: op,
    identity
  }
}

export function deriveIdentity<F extends URIS, A>(
  D: Derive11<F, URI>,
  I: Identity<A>
): Identity<Kind<F, A>> {
  return D.derive(I)
}
