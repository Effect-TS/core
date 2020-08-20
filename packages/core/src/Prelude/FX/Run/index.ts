import type { Either } from "@effect-ts/system/Either"

import type { Auto, Base, Kind, OrFix, URIS } from "../../HKT"

export interface Run<F extends URIS, C = Auto> extends Base<F, C> {
  readonly run: <N extends string, K, SI, SO, X, I, S, R, E, A>(
    fa: Kind<
      F,
      C,
      OrFix<"N", C, N>,
      OrFix<"K", C, K>,
      SI,
      SO,
      OrFix<"X", C, X>,
      OrFix<"I", C, I>,
      OrFix<"S", C, S>,
      OrFix<"R", C, R>,
      OrFix<"E", C, E>,
      A
    >
  ) => Kind<
    F,
    C,
    OrFix<"N", C, N>,
    OrFix<"K", C, K>,
    SI,
    SO,
    OrFix<"X", C, X>,
    OrFix<"I", C, I>,
    OrFix<"S", C, S>,
    OrFix<"R", C, R>,
    OrFix<"E", C, never>,
    Either<OrFix<"E", C, E>, A>
  >
}
