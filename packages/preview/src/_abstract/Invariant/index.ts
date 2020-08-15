import { HasURI, HKTTL, KindTL, URIS } from "../HKT"

export interface InvariantF<F, TL0 = any, TL1 = any, TL2 = any, TL3 = any>
  extends HasURI<F, TL0, TL1, TL2, TL3> {
  readonly invmap: <A, B>(fg: {
    f: (a: A) => B
    g: (b: B) => A
  }) => {
    f: <K, NK extends string, SI, SO, X, In, S, Env, Err>(
      ma: HKTTL<F, TL0, TL1, TL2, TL3, K, NK, SI, SO, X, In, S, Env, Err, A>
    ) => HKTTL<F, TL0, TL1, TL2, TL3, K, NK, SI, SO, X, In, S, Env, Err, B>
    g: <K, NK extends string, SI, SO, X, In, S, Env, Err>(
      mb: HKTTL<F, TL0, TL1, TL2, TL3, K, NK, SI, SO, X, In, S, Env, Err, B>
    ) => HKTTL<F, TL0, TL1, TL2, TL3, K, NK, SI, SO, X, In, S, Env, Err, A>
  }
}

export interface InvariantK<F extends URIS, TL0 = any, TL1 = any, TL2 = any, TL3 = any>
  extends HasURI<F, TL0, TL1, TL2, TL3> {
  readonly invmap: <A, B>(fg: {
    f: (a: A) => B
    g: (b: B) => A
  }) => {
    f: <K, NK extends string, SI, SO, X, In, S, Env, Err>(
      ma: KindTL<F, TL0, TL1, TL2, TL3, K, NK, SI, SO, X, In, S, Env, Err, A>
    ) => KindTL<F, TL0, TL1, TL2, TL3, K, NK, SI, SO, X, In, S, Env, Err, B>
    g: <K, NK extends string, SI, SO, X, In, S, Env, Err>(
      mb: KindTL<F, TL0, TL1, TL2, TL3, K, NK, SI, SO, X, In, S, Env, Err, B>
    ) => KindTL<F, TL0, TL1, TL2, TL3, K, NK, SI, SO, X, In, S, Env, Err, A>
  }
}

export interface InvariantKE<
  F extends URIS,
  E,
  TL0 = any,
  TL1 = any,
  TL2 = any,
  TL3 = any
> extends HasURI<F, TL0, TL1, TL2, TL3> {
  readonly invmap: <A, B>(fg: {
    f: (a: A) => B
    g: (b: B) => A
  }) => {
    f: <K, NK extends string, SI, SO, X, In, S, Env>(
      ma: KindTL<F, TL0, TL1, TL2, TL3, K, NK, SI, SO, X, In, S, Env, E, A>
    ) => KindTL<F, TL0, TL1, TL2, TL3, K, NK, SI, SO, X, In, S, Env, E, B>
    g: <K, NK extends string, SI, SO, X, In, S, Env>(
      mb: KindTL<F, TL0, TL1, TL2, TL3, K, NK, SI, SO, X, In, S, Env, E, B>
    ) => KindTL<F, TL0, TL1, TL2, TL3, K, NK, SI, SO, X, In, S, Env, E, A>
  }
}

export function makeInvariant<URI extends URIS, E>(): <
  TL0 = any,
  TL1 = any,
  TL2 = any,
  TL3 = any
>() => (
  _: Omit<
    InvariantKE<URI, E, TL0, TL1, TL2, TL3>,
    "URI" | "TL0" | "TL1" | "TL2" | "TL3" | "_E"
  >
) => InvariantKE<URI, E, TL0, TL1, TL2, TL3>
export function makeInvariant<URI extends URIS>(): <
  TL0 = any,
  TL1 = any,
  TL2 = any,
  TL3 = any
>() => (
  _: Omit<InvariantK<URI, TL0, TL1, TL2, TL3>, "URI" | "TL0" | "TL1" | "TL2" | "TL3">
) => InvariantK<URI, TL0, TL1, TL2, TL3>
export function makeInvariant<URI>(): <
  TL0 = any,
  TL1 = any,
  TL2 = any,
  TL3 = any
>() => (
  _: Omit<InvariantF<URI, TL0, TL1, TL2, TL3>, "URI" | "TL0" | "TL1" | "TL2" | "TL3">
) => InvariantF<URI, TL0, TL1, TL2, TL3>
export function makeInvariant<URI>(): <
  TL0 = any,
  TL1 = any,
  TL2 = any,
  TL3 = any
>() => (
  _: Omit<InvariantF<URI, TL0, TL1, TL2, TL3>, "URI" | "TL0" | "TL1" | "TL2" | "TL3">
) => InvariantF<URI, TL0, TL1, TL2, TL3> {
  return () => (_) => ({
    URI: undefined as any,
    TL0: undefined as any,
    TL1: undefined as any,
    TL2: undefined as any,
    TL3: undefined as any,
    ..._
  })
}
