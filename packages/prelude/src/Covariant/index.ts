import * as HKT from "@effect-ts/hkt"

export interface Covariant<F extends HKT.URIS, C = HKT.Auto> extends HKT.Base<F, C> {
  readonly _Covariant: "Covariant"
  readonly map: <A, B>(
    f: (a: A) => B
  ) => <N extends string, K, Q, W, X, I, S, R, E>(
    fa: HKT.Kind<F, C, N, K, Q, W, X, I, S, R, E, A>
  ) => HKT.Kind<F, C, N, K, Q, W, X, I, S, R, E, B>
}

export interface CovariantComposition<
  F extends HKT.URIS,
  G extends HKT.URIS,
  CF = HKT.Auto,
  CG = HKT.Auto
> extends HKT.CompositionBase2<F, G, CF, CG> {
  readonly map: <A, B>(
    f: (a: A) => B
  ) => <
    FN extends string,
    FK,
    FQ,
    FW,
    FX,
    FI,
    FS,
    FR,
    FE,
    GN extends string,
    GK,
    GQ,
    GW,
    GX,
    GI,
    GS,
    GR,
    GE
  >(
    fa: HKT.Kind<
      F,
      CF,
      FN,
      FK,
      FQ,
      FW,
      FX,
      FI,
      FS,
      FR,
      FE,
      HKT.Kind<G, CG, GN, GK, GQ, GW, GX, GI, GS, GR, GE, A>
    >
  ) => HKT.Kind<
    F,
    CF,
    FN,
    FK,
    FQ,
    FW,
    FX,
    FI,
    FS,
    FR,
    FE,
    HKT.Kind<G, CG, GN, GK, GQ, GW, GX, GI, GS, GR, GE, B>
  >
}

export function getCovariantComposition<
  F extends HKT.URIS,
  G extends HKT.URIS,
  CF = HKT.Auto,
  CG = HKT.Auto
>(F: Covariant<F, CF>, G: Covariant<G, CG>): CovariantComposition<F, G, CF, CG>
export function getCovariantComposition<F, G>(
  F: Covariant<HKT.UHKT<F>>,
  G: Covariant<HKT.UHKT<G>>
) {
  return HKT.instance<CovariantComposition<HKT.UHKT<F>, HKT.UHKT<G>>>({
    map: (f) => F.map(G.map(f))
  })
}
