import { array } from "../Array"
import { Option } from "../Option"
import { AsyncRE } from "../Support/Common/effect"

import { parEffect } from "./parEffect"

export const parWitherArray: <A, R, E, B>(
  f: (a: A) => AsyncRE<R, E, Option<B>>
) => (ta: Array<A>) => AsyncRE<R, E, Array<B>> = (f) => (ta) =>
  array.wither(parEffect)(ta, f)
