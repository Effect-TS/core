import type * as HKT from "@effect-ts/hkt"

export interface CovariantWithIndex<F extends HKT.URIS, C = HKT.Auto>
  extends HKT.Base<F, C> {
  readonly _CovariantWithIndex: "CovariantWithIndex"
  readonly mapWithIndex: <N extends string, K, A, B>(
    f: (k: HKT.IndexFor<F, HKT.OrFix<"N", C, N>, HKT.OrFix<"K", C, K>>, a: A) => B
  ) => <W, Q, X, I, S, R, E>(
    fa: HKT.Kind<F, C, N, K, W, Q, X, I, S, R, E, A>
  ) => HKT.Kind<F, C, N, K, W, Q, X, I, S, R, E, B>
}
