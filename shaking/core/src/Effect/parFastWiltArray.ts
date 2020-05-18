import type { Separated } from "fp-ts/lib/Compactable"

import { wilt_ } from "../Array/array"
import type { Either } from "../Either/either"
import type { AsyncRE } from "../Support/Common/effect"

import { parFastEffect } from "./parFastEffect"

export const parFastWiltArray_ = wilt_(parFastEffect)

export const parFastWiltArray: <A, R, E, B, C>(
  f: (a: A) => AsyncRE<R, E, Either<B, C>>
) => (wa: Array<A>) => AsyncRE<R, E, Separated<Array<B>, Array<C>>> = (f) => (wa) =>
  parFastWiltArray_(wa, f)
