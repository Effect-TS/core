export const UF_ = "F_"
export type UF_ = typeof UF_
export interface F_<A> {
  URI: UF_
  A: A
}

export const UF__ = "F__"
export type UF__ = typeof UF__
export interface F__<E, A> {
  URI: UF__
  E: () => E
  A: A
}

export const UF___ = "F___"
export type UF___ = typeof UF___
export interface F___<R, E, A> {
  URI: UF___
  R: (_: R) => void
  E: () => E
  A: A
}

export const UF____ = "F____"
export type UF____ = typeof UF____
export interface F____<S, R, E, A> {
  URI: UF____
  S: S
  R: (_: R) => void
  E: () => E
  A: A
}

export const UG_ = "G_"
export type UG_ = typeof UG_
export interface G_<A> {
  URI: UG_
  A: A
}

export const HKTFullURI = "HKTFullURI"
export type HKTFullURI = typeof HKTFullURI
export interface HKTFull<K, SI, SO, X, I, S, R, E, A> {
  URI: HKTFullURI
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

export interface URItoKind<D, N extends string, K, SI, SO, X, I, S, R, E, A> {
  [UF_]: F_<A>
  [UG_]: G_<A>
  [UF__]: F__<E, A>
  [UF___]: F___<R, E, A>
  [UF____]: F____<S, R, E, A>
}

export interface URItoIndex<N extends string, K> {}

export type URISL0 = keyof URItoKind<
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any,
  any
>

export interface Auto {
  readonly Auto: unique symbol
}

export interface Base<F, C = Auto> {
  F: F
  C: C
}

export interface CompositionBase2<F, G, CF = Auto, CG = Auto> {
  F: F
  G: G
  CF: CF
  CG: CG
}
