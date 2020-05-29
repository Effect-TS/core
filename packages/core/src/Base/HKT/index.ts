/* adapted from https://github.com/gcanti/fp-ts */

/* eslint-disable @typescript-eslint/no-empty-interface */

import type {
  HKT,
  HKT2,
  HKT3,
  HKT4,
  Kind,
  Kind2,
  Kind3,
  Kind4,
  URIS,
  URIS2,
  URIS3,
  URIS4,
  URItoKind,
  URItoKind2,
  URItoKind3,
  URItoKind4
} from "fp-ts/lib/HKT"

import type {
  EffectURI,
  Effect,
  Managed,
  ManagedURI,
  Stream,
  StreamURI,
  StreamEither,
  StreamEitherURI
} from "../../Support/Common"

declare module "fp-ts/lib/HKT" {
  interface URItoKind4<S, R, E, A> extends MaToKind<S, R, E, A> {}
}

export interface MaToKind<S, R, E, A> {
  [EffectURI]: Effect<S, R, E, A>
  [ManagedURI]: Managed<S, R, E, A>
  [StreamURI]: Stream<S, R, E, A>
  [StreamEitherURI]: StreamEither<S, R, E, A>
}

/**
 * `* -> * -> * -> * -> *` constructors restricted to MaTypes (behaviourally different)
 */
export type MaURIS = keyof MaToKind<any, any, any, any>

export {
  HKT,
  HKT2,
  HKT3,
  HKT4,
  Kind,
  Kind2,
  Kind3,
  Kind4,
  URIS,
  URIS2,
  URIS3,
  URIS4,
  URItoKind,
  URItoKind2,
  URItoKind3,
  URItoKind4
}
