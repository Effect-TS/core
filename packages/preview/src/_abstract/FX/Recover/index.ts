import { ErrFor, HasURI, HKTFix, KindFix, URIS } from "../../HKT"

export interface RecoverF<F, Fix0 = any, Fix1 = any, Fix2 = any, Fix3 = any>
  extends HasURI<F, Fix0, Fix1, Fix2, Fix3> {
  readonly recover: <K2, KN2 extends string, X2, SO2, I2, R2, E2, A2, E, S, SI>(
    f: (
      e: ErrFor<F, Fix0, Fix1, Fix2, Fix3, E>
    ) => HKTFix<F, Fix0, Fix1, Fix2, Fix3, K2, KN2, SI, SO2, X2, I2, S, R2, E2, A2>
  ) => <K, KN extends string, X, SO, I, R, A>(
    fa: HKTFix<F, Fix0, Fix1, Fix2, Fix3, K, KN, SI, SO, X, I, S, R, E, A>
  ) => HKTFix<
    F,
    Fix0,
    Fix1,
    Fix2,
    Fix3,
    K | K2,
    KN | KN2,
    SI,
    SO | SO2,
    X | X2,
    I & I2,
    S,
    R & R2,
    E2,
    A | A2
  >
}

export interface RecoverK<
  F extends URIS,
  Fix0 = any,
  Fix1 = any,
  Fix2 = any,
  Fix3 = any
> extends HasURI<F, Fix0, Fix1, Fix2, Fix3> {
  readonly recover: <K2, KN2 extends string, X2, SO2, I2, R2, E2, A2, E, S, SI>(
    f: (
      e: ErrFor<F, Fix0, Fix1, Fix2, Fix3, E>
    ) => KindFix<F, Fix0, Fix1, Fix2, Fix3, K2, KN2, SI, SO2, X2, I2, S, R2, E2, A2>
  ) => <K, KN extends string, X, SO, I, R, A>(
    fa: KindFix<F, Fix0, Fix1, Fix2, Fix3, K, KN, SI, SO, X, I, S, R, E, A>
  ) => KindFix<
    F,
    Fix0,
    Fix1,
    Fix2,
    Fix3,
    K | K2,
    KN | KN2,
    SI,
    SO | SO2,
    X | X2,
    I & I2,
    S,
    R & R2,
    E2,
    A | A2
  >
}

export function makeRecover<
  URI extends URIS,
  Fix0 = any,
  Fix1 = any,
  Fix2 = any,
  Fix3 = any
>(
  _: URI
): (
  _: Omit<
    RecoverK<URI, Fix0, Fix1, Fix2, Fix3>,
    "URI" | "Fix0" | "Fix1" | "Fix2" | "Fix3"
  >
) => RecoverK<URI, Fix0, Fix1, Fix2, Fix3>
export function makeRecover<URI, Fix0 = any, Fix1 = any, Fix2 = any, Fix3 = any>(
  URI: URI
): (
  _: Omit<
    RecoverF<URI, Fix0, Fix1, Fix2, Fix3>,
    "URI" | "Fix0" | "Fix1" | "Fix2" | "Fix3"
  >
) => RecoverF<URI, Fix0, Fix1, Fix2, Fix3>
export function makeRecover<URI, Fix0 = any, Fix1 = any, Fix2 = any, Fix3 = any>(
  URI: URI
): (
  _: Omit<
    RecoverF<URI, Fix0, Fix1, Fix2, Fix3>,
    "URI" | "Fix0" | "Fix1" | "Fix2" | "Fix3"
  >
) => RecoverF<URI, Fix0, Fix1, Fix2, Fix3> {
  return (_) => ({
    URI,
    Fix0: undefined as any,
    Fix1: undefined as any,
    Fix2: undefined as any,
    Fix3: undefined as any,
    Recover: "Recover",
    ..._
  })
}
