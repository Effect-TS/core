import type { Effect, AsyncRE } from "../Support/Common/effect"
import { traverse_, Tree } from "../Tree"

import { parFastEffect } from "./parFastEffect"

export const parFastTraverseTree_ = traverse_(parFastEffect)

export const parFastTraverseTree: <A, S, R, E, B>(
  f: (a: A) => Effect<S, R, E, B>
) => (ta: Tree<A>) => AsyncRE<R, E, Tree<B>> = (f) => (ta) =>
  parFastTraverseTree_(ta, f)
