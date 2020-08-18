import { Auto, Base, Kind, OrE, OrI, OrK, OrN, OrR, OrS, OrX, URIS } from "../HKT"

export interface AssociativeBoth<F extends URIS, C = Auto> extends Base<F> {
  readonly both: <N2 extends string, K2, SO, SO2, X2, I2, S, R2, E2, B>(
    fb: Kind<
      F,
      OrN<C, N2>,
      OrK<C, K2>,
      SO,
      SO2,
      OrX<C, X2>,
      OrI<C, I2>,
      OrS<C, S>,
      OrR<C, R2>,
      OrE<C, E2>,
      B
    >
  ) => <N extends string, K, SI, X, I, R, E, A>(
    fa: Kind<
      F,
      OrN<C, N>,
      OrK<C, K>,
      SI,
      SO,
      OrX<C, X>,
      OrI<C, I>,
      OrS<C, S>,
      OrR<C, R>,
      OrE<C, E>,
      A
    >
  ) => Kind<
    F,
    OrN<C, N2>,
    OrK<C, K2>,
    SI,
    SO2,
    OrX<C, X | X2>,
    OrI<C, I & I2>,
    OrS<C, S>,
    OrR<C, R & R2>,
    OrE<C, E | E2>,
    readonly [A, B]
  >
}
