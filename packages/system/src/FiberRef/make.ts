import type { UIO } from "../Effect/effect"
import { IFiberRefNew } from "../Effect/primitives"
import { identity } from "../Function"
import { FiberRef } from "./fiberRef"

/**
 * Creates a new `FiberRef` with given initial value.
 */
export const make = <A>(
  initial: A,
  onFork: (a: A) => A = identity,
  onJoin: (a: A, a2: A) => A = (_, a) => a
): UIO<FiberRef<A>> => new IFiberRefNew(initial, onFork, onJoin)

/**
 * Creates a new `FiberRef` with given initial value.
 */
export const unsafeMake = <A>(
  initial: A,
  onFork: (a: A) => A = identity,
  onJoin: (a: A, a2: A) => A = (_, a) => a
): FiberRef<A> => new FiberRef(initial, onFork, onJoin)
