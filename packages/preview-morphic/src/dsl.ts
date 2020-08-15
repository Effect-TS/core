import { AsyncStackURI } from "./uris"
import { AnyStackF, AsyncStackF, BaseStackF, foldStack, SyncStackF } from "./utils"

import { constant, pipe } from "@matechs/preview/Function"
import { Augmented, Has } from "@matechs/preview/Has"
import {
  succeedF,
  chainF,
  accessMF,
  accessServiceMF
} from "@matechs/preview/_abstract/DSL/core"
import { HKTTL } from "@matechs/preview/_abstract/HKT"

export interface SyncDSL<F> extends DSL<F>, SyncStackF<F> {}

export interface AsyncDSL<F> extends DSL<F>, AsyncStackF<F> {}

export interface DSL<F> {
  foldStack: <A, B>(f: (_: AsyncStackF<F>) => A, g: (_: SyncStackF<F>) => B) => A | B

  succeed: <A>(
    a: A
  ) => HKTTL<
    F,
    any,
    any,
    any,
    any,
    never,
    never,
    unknown,
    unknown,
    never,
    unknown,
    unknown,
    unknown,
    never,
    A
  >

  recover: <S, SO, K2, KN2 extends string, X2, I2, R2, E2, A2>(
    f: (
      e: string[]
    ) => HKTTL<F, any, any, any, any, K2, KN2, SO, SO, X2, I2, S, R2, E2, A2>
  ) => <K, KN extends string, SI, X, I, R, A>(
    fa: HKTTL<F, any, any, any, any, K, KN, SI, SO, X, I, S, R, string[], A>
  ) => HKTTL<
    F,
    any,
    any,
    any,
    any,
    K2,
    KN2,
    SI,
    SO,
    X | X2,
    I & I2,
    S,
    R & R2,
    E2,
    A | A2
  >

  chain: <TK, TKN extends string, SO, SO2, X, I, S, R, E, A, B>(
    f: (_: A) => HKTTL<F, any, any, any, any, TK, TKN, SO, SO2, X, I, S, R, E, B>
  ) => <SK, SKN extends string, SI, X2, I2, R2, E2>(
    mk: HKTTL<F, any, any, any, any, SK, SKN, SI, SO, X2, I2, S, R2, E2, A>
  ) => HKTTL<
    F,
    any,
    any,
    any,
    any,
    TK,
    TKN,
    SI,
    SO2,
    X | X2,
    I & I2,
    S,
    R & R2,
    E | E2,
    B
  >

  accessM: <TK, TKN extends string, SI, SO, X, I, S, R, E, R0, A>(
    f: (r: R0) => HKTTL<F, any, any, any, any, TK, TKN, SI, SO, X, I, S, R, E, A>
  ) => HKTTL<F, any, any, any, any, TK, TKN, SI, SO, X, I, S, R & R0, E, A>

  accessServiceM: <SR>(
    Has: Augmented<SR>
  ) => <TK, TKN extends string, SI, SO, Y, X, S, R1, E, A>(
    f: (r: SR) => HKTTL<F, any, any, any, any, TK, TKN, SI, SO, Y, X, S, R1, E, A>
  ) => HKTTL<F, any, any, any, any, TK, TKN, SI, SO, Y, X, S, R1 & Has<SR>, E, A>
}

export function dsl<F>(_: { K: BaseStackF<F> }): DSL<F> {
  const succeed = <A>(a: A) => succeedF(_.K)(constant(a))

  const recover = <
    K,
    KN extends string,
    SI,
    SO,
    X,
    I,
    S,
    R,
    A,
    K2,
    KN2 extends string,
    X2,
    I2,
    R2,
    E2,
    A2
  >(
    fa: HKTTL<F, any, any, any, any, K, KN, SI, SO, X, I, S, R, string[], A>,
    f: (
      e: string[]
    ) => HKTTL<F, any, any, any, any, K2, KN2, SO, SO, X2, I2, S, R2, E2, A2>
  ) =>
    pipe(
      fa,
      _.K.run,
      _.K.map((e) =>
        e._tag === "Right"
          ? succeedF(_.K)<A | A2, S, SO, SO>(constant(e.right))
          : f(e.left)
      ),
      _.K.flatten
    )

  const chain = chainF(_.K)
  const accessM = accessMF(_.K)
  const accessServiceM = accessServiceMF(_.K)

  return {
    succeed,
    recover: (f) => (fa) => recover(fa, f),
    foldStack: (f, g) => foldStack(_.K as AnyStackF<F>)(f, g),
    chain,
    accessM,
    accessServiceM
  }
}

export function commonDSL<F>(_: {
  K: BaseStackF<F>
}): AsyncStackURI extends F ? AsyncDSL<F> : SyncDSL<F> {
  const d = dsl(_)
  return {
    ..._.K,
    recover: d.recover,
    succeed: d.succeed,
    foldStack: d.foldStack
  } as any
}
