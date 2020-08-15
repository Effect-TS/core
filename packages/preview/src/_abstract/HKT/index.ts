/**
 * Inspired by https://github.com/gcanti/fp-ts/blob/master/src/HKT.ts
 */

import { identity } from "../../_system/Function"

export type HKT<URI, Out> = HKT2<URI, any, Out>

export type HKT2<URI, Err, Out> = HKT3<URI, any, Err, Out>

export type HKT3<URI, Env, Err, Out> = HKT4<URI, any, Env, Err, Out>

export type HKT4<URI, St, Env, Err, Out> = HKT5<URI, any, St, Env, Err, Out>

export type HKT5<URI, In, St, Env, Err, Out> = HKT6<URI, any, In, St, Env, Err, Out>

export type HKT6<URI, X, In, St, Env, Err, Out> = HKT7<
  URI,
  any,
  X,
  In,
  St,
  Env,
  Err,
  Out
>

export type HKT7<URI, SO, X, In, St, Env, Err, Out> = HKT8<
  URI,
  any,
  SO,
  X,
  In,
  St,
  Env,
  Err,
  Out
>

export type HKT8<URI, SI, SO, X, In, St, Env, Err, Out> = HKT9<
  URI,
  any,
  SI,
  SO,
  X,
  In,
  St,
  Env,
  Err,
  Out
>

export type HKT9<URI, NK extends string, SI, SO, X, In, St, Env, Err, Out> = HKT10<
  URI,
  any,
  NK,
  SI,
  SO,
  X,
  In,
  St,
  Env,
  Err,
  Out
>

export type HKT10<URI, K, NK extends string, SI, SO, X, In, St, Env, Err, Out> = HKTFix<
  URI,
  any,
  any,
  any,
  any,
  K,
  NK,
  SI,
  SO,
  X,
  In,
  St,
  Env,
  Err,
  Out
>

export interface HKTFix<
  URI,
  Fix0,
  Fix1,
  Fix2,
  Fix3,
  K,
  NK extends string,
  SI,
  SO,
  X,
  In,
  St,
  Env,
  Err,
  Out
> {
  readonly _URI: URI
  readonly _Fix0: Fix0
  readonly _Fix1: Fix1
  readonly _Fix2: Fix2
  readonly _Fix3: Fix3
  readonly _Out: () => Out
  readonly _Err: () => Err
  readonly _Env: (_: Env) => void
  readonly _St: St
  readonly _In: (_: In) => void
  readonly _X: () => X
  readonly _O: () => SO
  readonly _I: (_: SI) => void
  readonly _NK: () => NK
  readonly _K: () => K
}

/**
 * Typelevel Map: URI => Type
 */
export interface URItoKind<
  // Encode fixed parameters for derived instances (eg: Validation<E, *> given Identity<E>)
  Fix0,
  Fix1,
  Fix2,
  Fix3,
  // Encode generic keys
  K,
  // Encode nominal (string based) keys
  NK extends string,
  // Encode state input
  SI,
  // Encode state output
  SO,
  // Encode generic contravariant (used to encode async/sync)
  X,
  // Encode contravariant input
  I,
  // Encode invariant state
  S,
  // Encode contravariant input
  Env,
  // Encode covariant error
  Err,
  // Encode covariant output
  Out
> {}

/**
 * URI of the Typelevel Map
 */
export type URIS = keyof URItoKind<
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
  any,
  any,
  any,
  any
>

/**
 * KindFix<F, Fix0, Fix1, Fix2, Fix3,A> = URItoKind[F][A]
 */
export type Kind<
  URI extends URIS,
  K,
  NK extends string,
  SI,
  SO,
  X,
  In,
  St,
  Env,
  Err,
  Out
> = URI extends URIS
  ? URItoKind<any, any, any, any, K, NK, SI, SO, X, In, St, Env, Err, Out>[URI]
  : any

export type KindFix<
  URI extends URIS,
  Fix0,
  Fix1,
  Fix2,
  Fix3,
  K,
  NK extends string,
  SI,
  SO,
  X,
  In,
  St,
  Env,
  Err,
  Out
> = URI extends URIS
  ? URItoKind<Fix0, Fix1, Fix2, Fix3, K, NK, SI, SO, X, In, St, Env, Err, Out>[URI]
  : any

/**
 * Used to require URI in typeclasses
 */
export interface HasURI<F, Fix0 = any, Fix1 = any, Fix2 = any, Fix3 = any> {
  readonly URI: F
  readonly Fix0: Fix0
  readonly Fix1: Fix1
  readonly Fix2: Fix2
  readonly Fix3: Fix3
}

export interface HasE<E> {
  readonly _E: E
}

export function castErr<T>(): {
  <F extends URIS>(_?: F): <
    K,
    Fix0,
    Fix1,
    Fix2,
    Fix3,
    NK extends string,
    SI,
    SO,
    X,
    In,
    St,
    Env,
    Err,
    Out
  >(
    self: KindFix<F, Fix0, Fix1, Fix2, Fix3, K, NK, SI, SO, X, In, St, Env, Err, Out>
  ) => KindFix<F, Fix0, Fix1, Fix2, Fix3, K, NK, SI, SO, X, In, St, Env, T, Out>
  <F>(_?: F): <
    K,
    Fix0,
    Fix1,
    Fix2,
    Fix3,
    NK extends string,
    SI,
    SO,
    X,
    In,
    St,
    Env,
    Err,
    Out
  >(
    self: HKTFix<F, Fix0, Fix1, Fix2, Fix3, K, NK, SI, SO, X, In, St, Env, Err, Out>
  ) => HKTFix<F, Fix0, Fix1, Fix2, Fix3, K, NK, SI, SO, X, In, St, Env, T, Out>
}
export function castErr() {
  return () => identity as any
}

export function castEnv<T>(): {
  <F extends URIS>(_?: F): <
    K,
    Fix0,
    Fix1,
    Fix2,
    Fix3,
    NK extends string,
    SI,
    SO,
    X,
    In,
    St,
    Env,
    Err,
    Out
  >(
    self: KindFix<F, Fix0, Fix1, Fix2, Fix3, K, NK, SI, SO, X, In, St, Env, Err, Out>
  ) => KindFix<F, Fix0, Fix1, Fix2, Fix3, K, NK, SI, SO, X, In, St, T, Err, Out>
  <F>(_?: F): <
    K,
    Fix0,
    Fix1,
    Fix2,
    Fix3,
    NK extends string,
    SI,
    SO,
    X,
    In,
    St,
    Env,
    Err,
    Out
  >(
    self: HKTFix<F, Fix0, Fix1, Fix2, Fix3, K, NK, SI, SO, X, In, St, Env, Err, Out>
  ) => HKTFix<F, Fix0, Fix1, Fix2, Fix3, K, NK, SI, SO, X, In, St, T, Err, Out>
}
export function castEnv() {
  return () => identity as any
}

export function castSt<T>(): {
  <F extends URIS>(_?: F): <
    K,
    Fix0,
    Fix1,
    Fix2,
    Fix3,
    NK extends string,
    SI,
    SO,
    X,
    In,
    St,
    Env,
    Err,
    Out
  >(
    self: KindFix<F, Fix0, Fix1, Fix2, Fix3, K, NK, SI, SO, X, In, St, Env, Err, Out>
  ) => KindFix<F, Fix0, Fix1, Fix2, Fix3, K, NK, SI, SO, X, In, T, Env, Err, Out>
  <F>(_?: F): <
    K,
    Fix0,
    Fix1,
    Fix2,
    Fix3,
    NK extends string,
    SI,
    SO,
    X,
    In,
    St,
    Env,
    Err,
    Out
  >(
    self: HKTFix<F, Fix0, Fix1, Fix2, Fix3, K, NK, SI, SO, X, In, St, Env, Err, Out>
  ) => HKTFix<F, Fix0, Fix1, Fix2, Fix3, K, NK, SI, SO, X, In, T, Env, Err, Out>
}
export function castSt() {
  return () => identity as any
}

export function castIn<T>(): {
  <F extends URIS>(_?: F): <
    K,
    Fix0,
    Fix1,
    Fix2,
    Fix3,
    NK extends string,
    SI,
    SO,
    X,
    In,
    St,
    Env,
    Err,
    Out
  >(
    self: KindFix<F, Fix0, Fix1, Fix2, Fix3, K, NK, SI, SO, X, In, St, Env, Err, Out>
  ) => KindFix<F, Fix0, Fix1, Fix2, Fix3, K, NK, SI, SO, X, T, St, Env, Err, Out>
  <F>(_?: F): <
    K,
    Fix0,
    Fix1,
    Fix2,
    Fix3,
    NK extends string,
    SI,
    SO,
    X,
    In,
    St,
    Env,
    Err,
    Out
  >(
    self: HKTFix<F, Fix0, Fix1, Fix2, Fix3, K, NK, SI, SO, X, In, St, Env, Err, Out>
  ) => HKTFix<F, Fix0, Fix1, Fix2, Fix3, K, NK, SI, SO, X, T, St, Env, Err, Out>
}
export function castIn() {
  return () => identity as any
}

export function castX<T>(): {
  <F extends URIS>(_?: F): <
    K,
    Fix0,
    Fix1,
    Fix2,
    Fix3,
    NK extends string,
    SI,
    SO,
    X,
    In,
    St,
    Env,
    Err,
    Out
  >(
    self: KindFix<F, Fix0, Fix1, Fix2, Fix3, K, NK, SI, SO, X, In, St, Env, Err, Out>
  ) => KindFix<F, Fix0, Fix1, Fix2, Fix3, K, NK, SI, SO, T, In, St, Env, Err, Out>
  <F>(_?: F): <
    K,
    Fix0,
    Fix1,
    Fix2,
    Fix3,
    NK extends string,
    SI,
    SO,
    X,
    In,
    St,
    Env,
    Err,
    Out
  >(
    self: HKTFix<F, Fix0, Fix1, Fix2, Fix3, K, NK, SI, SO, X, In, St, Env, Err, Out>
  ) => HKTFix<F, Fix0, Fix1, Fix2, Fix3, K, NK, SI, SO, T, In, St, Env, Err, Out>
}
export function castX() {
  return () => identity as any
}

export function castSO<T>(): {
  <F extends URIS>(_?: F): <
    Fix0,
    Fix1,
    Fix2,
    Fix3,
    K,
    NK extends string,
    SI,
    SO,
    X,
    In,
    St,
    Env,
    Err,
    Out
  >(
    self: KindFix<F, Fix0, Fix1, Fix2, Fix3, K, NK, SI, SO, X, In, St, Env, Err, Out>
  ) => KindFix<F, Fix0, Fix1, Fix2, Fix3, K, NK, SI, T, X, In, St, Env, Err, Out>
  <F>(_?: F): <
    Fix0,
    Fix1,
    Fix2,
    Fix3,
    K,
    NK extends string,
    SI,
    SO,
    X,
    In,
    St,
    Env,
    Err,
    Out
  >(
    self: HKTFix<F, Fix0, Fix1, Fix2, Fix3, K, NK, SI, SO, X, In, St, Env, Err, Out>
  ) => HKTFix<F, Fix0, Fix1, Fix2, Fix3, K, NK, SI, T, X, In, St, Env, Err, Out>
}
export function castSO() {
  return () => identity as any
}

export function castSI<T>(): {
  <F extends URIS>(_?: F): <
    K,
    Fix0,
    Fix1,
    Fix2,
    Fix3,
    NK extends string,
    SI,
    SO,
    X,
    In,
    St,
    Env,
    Err,
    Out
  >(
    self: KindFix<F, Fix0, Fix1, Fix2, Fix3, K, NK, SI, SO, X, In, St, Env, Err, Out>
  ) => KindFix<F, Fix0, Fix1, Fix2, Fix3, K, NK, T, SO, X, In, St, Env, Err, Out>
  <F>(_?: F): <
    Fix0,
    Fix1,
    Fix2,
    Fix3,
    K,
    NK extends string,
    SI,
    SO,
    X,
    In,
    St,
    Env,
    Err,
    Out
  >(
    self: HKTFix<F, Fix0, Fix1, Fix2, Fix3, K, NK, SI, SO, X, In, St, Env, Err, Out>
  ) => HKTFix<F, Fix0, Fix1, Fix2, Fix3, K, NK, T, SO, X, In, St, Env, Err, Out>
}
export function castSI() {
  return () => identity as any
}

export function castS<T>(): {
  <F extends URIS>(_?: F): <
    K,
    Fix0,
    Fix1,
    Fix2,
    Fix3,
    NK extends string,
    SI,
    SO,
    X,
    In,
    St,
    Env,
    Err,
    Out
  >(
    self: KindFix<F, Fix0, Fix1, Fix2, Fix3, K, NK, SI, SO, X, In, St, Env, Err, Out>
  ) => KindFix<F, Fix0, Fix1, Fix2, Fix3, K, NK, SI, SO, X, In, T, Env, Err, Out>
  <F>(_?: F): <
    Fix0,
    Fix1,
    Fix2,
    Fix3,
    K,
    NK extends string,
    SI,
    SO,
    X,
    In,
    St,
    Env,
    Err,
    Out
  >(
    self: HKTFix<F, Fix0, Fix1, Fix2, Fix3, K, NK, SI, SO, X, In, St, Env, Err, Out>
  ) => HKTFix<F, Fix0, Fix1, Fix2, Fix3, K, NK, SI, SO, X, In, T, Env, Err, Out>
}
export function castS() {
  return () => identity as any
}

export function castK<T extends string>(): {
  <F extends URIS>(_?: F): <
    K,
    Fix0,
    Fix1,
    Fix2,
    Fix3,
    NK extends string,
    SI,
    SO,
    X,
    In,
    St,
    Env,
    Err,
    Out
  >(
    self: KindFix<F, Fix0, Fix1, Fix2, Fix3, K, NK, SI, SO, X, In, St, Env, Err, Out>
  ) => KindFix<F, Fix0, Fix1, Fix2, Fix3, K, T, SI, SO, X, In, St, Env, Err, Out>
  <F>(_?: F): <
    K,
    Fix0,
    Fix1,
    Fix2,
    Fix3,
    NK extends string,
    SI,
    SO,
    X,
    In,
    St,
    Env,
    Err,
    Out
  >(
    self: HKTFix<F, Fix0, Fix1, Fix2, Fix3, K, NK, SI, SO, X, In, St, Env, Err, Out>
  ) => HKTFix<F, Fix0, Fix1, Fix2, Fix3, K, T, SI, SO, X, In, St, Env, Err, Out>
}
export function castK() {
  return () => identity as any
}

export interface URItoKeys<
  Fix0,
  Fix1,
  Fix2,
  Fix3,
  K,
  NK extends string,
  SI,
  SO,
  X,
  I,
  S,
  Env,
  Err,
  Out
> {}

export type KeyFor<
  F,
  Fix0,
  Fix1,
  Fix2,
  Fix3,
  K,
  NK extends string,
  SI,
  SO,
  X,
  I,
  S,
  Env,
  Err,
  Out
> = F extends keyof URItoKeys<
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
  any,
  any,
  any,
  any
>
  ? URItoKeys<Fix0, Fix1, Fix2, Fix3, K, NK, SI, SO, X, I, S, Env, Err, Out>[F]
  : never

export interface URItoErr<Fix0, Fix1, Fix2, Fix3, Err> {}

export type ErrFor<F, Fix0, Fix1, Fix2, Fix3, Err> = F extends keyof URItoErr<
  any,
  any,
  any,
  any,
  any
>
  ? URItoErr<Fix0, Fix1, Fix2, Fix3, Err>[F]
  : Err

export type HKTTypeS<
  H extends HKTFix<
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
    any,
    any,
    any,
    any,
    any
  >
> = H["_St"]

export type HKTTypeSO<
  H extends HKTFix<
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
    any,
    any,
    any,
    any,
    any
  >
> = ReturnType<H["_O"]>

export type HKTTypeSI<
  H extends HKTFix<
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
    any,
    any,
    any,
    any,
    any
  >
> = Parameters<H["_I"]>[0]
