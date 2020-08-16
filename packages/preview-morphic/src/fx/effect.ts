import { Effect } from "@matechs/preview/Effect"
import { HasE, HasURI, HKTFull, KindFull, URIS } from "@matechs/preview/_abstract/HKT"

export interface FromEffectF<F, TL0 = any, TL1 = any, TL2 = any, TL3 = any>
  extends HasURI<F, TL0, TL1, TL2, TL3> {
  readonly fromEffect: <R, E, A>(
    fa: Effect<unknown, R, E, A>
  ) => HKTFull<F, TL0, TL1, TL2, TL3, any, any, any, any, any, any, any, R, E, A>
}

export interface FromEffectK<
  F extends URIS,
  TL0 = any,
  TL1 = any,
  TL2 = any,
  TL3 = any
> extends HasURI<F, TL0, TL1, TL2, TL3> {
  readonly fromEffect: <R, E, A>(
    fa: Effect<unknown, R, E, A>
  ) => KindFull<F, TL0, TL1, TL2, TL3, any, any, any, any, any, any, any, R, E, A>
}

export interface FromEffectKE<
  F extends URIS,
  E,
  TL0 = any,
  TL1 = any,
  TL2 = any,
  TL3 = any
> extends HasURI<F, TL0, TL1, TL2, TL3>, HasE<E> {
  readonly fromEffect: <R, E, A>(
    fa: Effect<unknown, R, E, A>
  ) => KindFull<F, TL0, TL1, TL2, TL3, any, any, any, any, any, any, any, R, E, A>
}

export function makeFromEffect<URI extends URIS, E>(): <
  TL0 = any,
  TL1 = any,
  TL2 = any,
  TL3 = any
>() => (
  _: Omit<
    FromEffectKE<URI, E, TL0, TL1, TL2, TL3>,
    "URI" | "TL0" | "TL1" | "TL2" | "TL3" | "_E"
  >
) => FromEffectKE<URI, E, TL0, TL1, TL2, TL3>
export function makeFromEffect<URI extends URIS>(): <
  TL0 = any,
  TL1 = any,
  TL2 = any,
  TL3 = any
>() => (
  _: Omit<FromEffectK<URI, TL0, TL1, TL2, TL3>, "URI" | "TL0" | "TL1" | "TL2" | "TL3">
) => FromEffectK<URI, TL0, TL1, TL2, TL3>
export function makeFromEffect<URI>(): <
  TL0 = any,
  TL1 = any,
  TL2 = any,
  TL3 = any
>() => (
  _: Omit<FromEffectF<URI, TL0, TL1, TL2, TL3>, "URI" | "TL0" | "TL1" | "TL2" | "TL3">
) => FromEffectF<URI, TL0, TL1, TL2, TL3>
export function makeFromEffect<URI>(): <
  TL0 = any,
  TL1 = any,
  TL2 = any,
  TL3 = any
>() => (
  _: Omit<FromEffectF<URI, TL0, TL1, TL2, TL3>, "URI" | "TL0" | "TL1" | "TL2" | "TL3">
) => FromEffectF<URI, TL0, TL1, TL2, TL3> {
  return () => (_) => ({
    URI: undefined as any,
    TL0: undefined as any,
    TL1: undefined as any,
    TL2: undefined as any,
    TL3: undefined as any,
    FromEffect: "FromEffect",
    ..._
  })
}
