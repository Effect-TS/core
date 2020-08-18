export interface HKT<K, SI, SO, X, I, S, R, E, A> {
  K: () => K
  SI: (_: SI) => void
  SO: () => SO
  X: () => X
  I: (_: I) => void
  S: S
  R: (_: R) => void
  E: () => E
  A: A
}

export type Kind2<F extends URIS, E, A> = Kind<
  F,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  E,
  A
>

export const HKTURI = "HKTURI"
export type HKTURI = typeof HKTURI

export interface URItoKind<K, SI, SO, X, I, S, R, E, A> {
  [HKTURI]: HKT<K, SI, SO, X, I, S, R, E, A>
}

export type URIS = keyof URItoKind<any, any, any, any, any, any, any, any, any>

export type Kind<URI extends URIS, K, SI, SO, X, I, S, R, E, A> = URI extends URIS
  ? URItoKind<K, SI, SO, X, I, S, R, E, A>[URI]
  : never

export interface Auto {
  readonly Auto: unique symbol
}

export { FixE, FixI, FixK, FixR, FixS, FixX, OrE, OrI, OrK, OrR, OrS, OrX } from "./fix"
