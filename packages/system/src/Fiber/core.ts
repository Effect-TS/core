import type * as Cause from "../Cause/core"
import * as T from "../Effect/core"
import type { UIO } from "../Effect/effect"
import * as Exit from "../Exit/core"
import type { FiberRef } from "../FiberRef/fiberRef"
import * as O from "../Option"
import type { Scope } from "../Scope"
import type { FiberID } from "./id"
import type { Status } from "./status"

export { equalsFiberID, FiberID, newFiberId, None } from "./id"

/**
 * A record containing information about a `Fiber`.
 *
 * @param id            The fiber's unique identifier
 * @param interruptors  The set of fibers attempting to interrupt the fiber or its ancestors.
 * @param children      The fiber's forked children.
 */
export class Descriptor {
  constructor(
    readonly id: FiberID,
    readonly status: Status,
    readonly interruptors: ReadonlySet<FiberID>,
    readonly interruptStatus: InterruptStatus,
    readonly scope: Scope<Exit.Exit<any, any>>
  ) {}
}

/**
 * A fiber is a lightweight thread of execution that never consumes more than a
 * whole thread (but may consume much less, depending on contention and
 * asynchronicity). Fibers are spawned by forking ZIO effects, which run
 * concurrently with the parent effect.
 *
 * Fibers can be joined, yielding their result to other fibers, or interrupted,
 * which terminates the fiber, safely releasing all resources.
 */
export type Fiber<E, A> = Runtime<E, A> | Synthetic<E, A>

export interface CommonFiber<E, A> {
  await: UIO<Exit.Exit<E, A>>
  getRef: <K>(fiberRef: FiberRef<K>) => UIO<K>
  inheritRefs: UIO<void>
  interruptAs(fiberId: FiberID): UIO<Exit.Exit<E, A>>
  poll: UIO<O.Option<Exit.Exit<E, A>>>
}

export interface Runtime<E, A> extends CommonFiber<E, A> {
  _tag: "RuntimeFiber"
}

export interface Synthetic<E, A> extends CommonFiber<E, A> {
  _tag: "SyntheticFiber"
}

export function makeSynthetic<E, A>(_: Synthetic<E, A>): Fiber<E, A> {
  return _
}

/**
 * Folds over the runtime or synthetic fiber.
 */
export const fold = <E, A, Z>(
  runtime: (_: Runtime<E, A>) => Z,
  syntetic: (_: Synthetic<E, A>) => Z
) => (fiber: Fiber<E, A>) => {
  switch (fiber._tag) {
    case "RuntimeFiber": {
      return runtime(fiber)
    }
    case "SyntheticFiber": {
      return syntetic(fiber)
    }
  }
}

/**
 * A fiber that is done with the specified `Exit` value.
 */
export const done = <E, A>(exit: Exit.Exit<E, A>): Synthetic<E, A> => ({
  _tag: "SyntheticFiber",
  await: T.succeed(exit),
  getRef: (ref) => T.succeed(ref.initial),
  inheritRefs: T.unit,
  interruptAs: () => T.succeed(exit),
  poll: T.succeed(O.some(exit))
})

/**
 * Returns a fiber that has already succeeded with the specified value.
 */
export const succeed = <A>(a: A) => done(Exit.succeed(a))

/**
 * A fiber that has already failed with the specified value.
 */
export const fail = <E>(e: E) => done(Exit.fail(e))

/**
 * Creates a `Fiber` that is halted with the specified cause.
 */
export const halt = <E>(cause: Cause.Cause<E>) => done(Exit.halt(cause))

/**
 * A fiber that is already interrupted.
 */
export const interruptAs = (id: FiberID) => done(Exit.interrupt(id))

/**
 * InterruptStatus tracks interruptability of the current stack region
 */
export class InterruptStatus {
  constructor(readonly isInterruptible: boolean) {}

  get isUninteruptible(): boolean {
    return !this.isInterruptible
  }

  get toBoolean(): boolean {
    return this.isInterruptible
  }
}

/**
 * Interruptible region
 */
export const interruptible = new InterruptStatus(true)

/**
 * Uninterruptible region
 */
export const uninterruptible = new InterruptStatus(false)

/**
 * Create InterruptStatus from a boolean value
 */
export const interruptStatus = (b: boolean) => (b ? interruptible : uninterruptible)
