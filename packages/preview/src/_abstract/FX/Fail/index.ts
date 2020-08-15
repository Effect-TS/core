import { HasE, HasURI, HKTFix, KindFix, URIS } from "../../HKT"

export interface FailF<F, Fix0 = any, Fix1 = any, Fix2 = any, Fix3 = any>
  extends HasURI<F, Fix0, Fix1, Fix2, Fix3> {
  readonly fail: <E, S, SI>(
    e: E
  ) => HKTFix<
    F,
    Fix0,
    Fix1,
    Fix2,
    Fix3,
    never,
    never,
    SI,
    never,
    never,
    unknown,
    S,
    unknown,
    E,
    never
  >
}

export interface FailK<F extends URIS, Fix0 = any, Fix1 = any, Fix2 = any, Fix3 = any>
  extends HasURI<F, Fix0, Fix1, Fix2, Fix3> {
  readonly fail: <E, S, SI>(
    e: E
  ) => KindFix<
    F,
    Fix0,
    Fix1,
    Fix2,
    Fix3,
    never,
    never,
    SI,
    never,
    never,
    unknown,
    S,
    unknown,
    E,
    never
  >
}

export interface FailKE<
  F extends URIS,
  E,
  Fix0 = any,
  Fix1 = any,
  Fix2 = any,
  Fix3 = any
> extends HasURI<F, Fix0, Fix1, Fix2, Fix3>, HasE<E> {
  readonly fail: <E, S, SI>(
    e: E
  ) => KindFix<
    F,
    Fix0,
    Fix1,
    Fix2,
    Fix3,
    never,
    never,
    SI,
    never,
    never,
    unknown,
    S,
    unknown,
    E,
    never
  >
}

export function makeFail<
  URI extends URIS,
  E,
  Fix0 = any,
  Fix1 = any,
  Fix2 = any,
  Fix3 = any
>(
  _: URI
): (
  _: Omit<
    FailKE<URI, Fix0, Fix1, Fix2, Fix3>,
    "URI" | "Fix0" | "Fix1" | "Fix2" | "Fix3" | "_E"
  >
) => FailKE<URI, Fix0, Fix1, Fix2, Fix3>
export function makeFail<
  URI extends URIS,
  Fix0 = any,
  Fix1 = any,
  Fix2 = any,
  Fix3 = any
>(
  _: URI
): (
  _: Omit<FailK<URI, Fix0, Fix1, Fix2, Fix3>, "URI" | "Fix0" | "Fix1" | "Fix2" | "Fix3">
) => FailK<URI, Fix0, Fix1, Fix2, Fix3>
export function makeFail<URI, Fix0 = any, Fix1 = any, Fix2 = any, Fix3 = any>(
  URI: URI
): (
  _: Omit<FailF<URI, Fix0, Fix1, Fix2, Fix3>, "URI" | "Fix0" | "Fix1" | "Fix2" | "Fix3">
) => FailF<URI, Fix0, Fix1, Fix2, Fix3>
export function makeFail<URI, Fix0 = any, Fix1 = any, Fix2 = any, Fix3 = any>(
  URI: URI
): (
  _: Omit<FailF<URI, Fix0, Fix1, Fix2, Fix3>, "URI" | "Fix0" | "Fix1" | "Fix2" | "Fix3">
) => FailF<URI, Fix0, Fix1, Fix2, Fix3> {
  return (_) => ({
    URI,
    Fix0: undefined as any,
    Fix1: undefined as any,
    Fix2: undefined as any,
    Fix3: undefined as any,
    Fail: "Fail",
    ..._
  })
}
