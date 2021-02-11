import type * as HKT from "@effect-ts/hkt"
import type { Option } from "@effect-ts/system/Option"

import type { Applicative } from "../Applicative"

export interface Wither<F extends HKT.URIS, C = HKT.Auto> {
  <G extends HKT.URIS, GC = HKT.Auto>(F: Applicative<G, GC>): <
    GN extends string,
    GK,
    GQ,
    GW,
    GX,
    GI,
    GS,
    GR,
    GE,
    A,
    B
  >(
    f: (a: A) => HKT.Kind<G, GC, GN, GK, GQ, GW, GX, GI, GS, GR, GE, Option<B>>
  ) => <FN extends string, FK, FSI, FSO, FX, FI, FS, FR, FE>(
    ta: HKT.Kind<F, C, FN, FK, FSI, FSO, FX, FI, FS, FR, FE, A>
  ) => HKT.Kind<
    G,
    GC,
    GN,
    GK,
    GQ,
    GW,
    GX,
    GI,
    GS,
    GR,
    GE,
    HKT.Kind<F, C, FN, FK, FSI, FSO, FX, FI, FS, FR, FE, B>
  >
}

export interface Witherable<F extends HKT.URIS, C = HKT.Auto> extends HKT.Base<F, C> {
  readonly _Witherable: "Witherable"
  readonly compactF: Wither<F, C>
}

export function implementCompactF<F extends HKT.URIS, C = HKT.Auto>(): (
  i: <FN extends string, FK, FQ, FW, FX, FI, FS, FR, FE, A, B, G>(_: {
    A: A
    B: B
    G: G
    FN: FN
    FK: FK
    FQ: FQ
    FW: FW
    FX: FX
    FI: FI
    FS: FS
    FR: FR
    FE: FE
  }) => (
    G: Applicative<HKT.UHKT<G>>
  ) => (
    f: (a: A) => HKT.HKT<G, Option<B>>
  ) => (
    ta: HKT.Kind<F, C, FN, FK, FQ, FW, FX, FI, FS, FR, FE, A>
  ) => HKT.HKT<G, HKT.Kind<F, C, FN, FK, FQ, FW, FX, FI, FS, FR, FE, B>>
) => Wither<F, C>
export function implementCompactF() {
  return (i: any) => i()
}
