import type * as HKT from "@effect-ts/hkt"

export interface Derive<F extends HKT.URIS, Typeclass extends HKT.URIS, C = HKT.Auto>
  extends HKT.Base<F, C> {
  readonly _Derive: "Derive"
  readonly derive: <N extends string, K, Q, W, X, I, S, R, E, A>(
    fa: HKT.Kind<Typeclass, C, N, K, Q, W, X, I, S, R, E, A>
  ) => HKT.Kind<
    Typeclass,
    C,
    N,
    K,
    Q,
    W,
    X,
    I,
    S,
    R,
    E,
    HKT.Kind<F, C, N, K, Q, W, X, I, S, R, E, A>
  >
}
