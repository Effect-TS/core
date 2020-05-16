import { wither } from "../Array/wither"
import type { Option } from "../Option/Option"
import type { AsyncRE } from "../Support/Common/effect"

import { parFastEffect } from "./parFastEffect"

export const parFastWitherArray_ = wither(parFastEffect)

export const parFastWitherArray: <A, R, E, B>(
  f: (a: A) => AsyncRE<R, E, Option<B>>
) => (ta: Array<A>) => AsyncRE<R, E, Array<B>> = (f) => (ta) =>
  parFastWitherArray_(ta, f)
