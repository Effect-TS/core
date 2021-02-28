import * as Cause from "../Cause/core"
import type { InterruptStatus } from "../Fiber/core"
import * as Fiber from "../Fiber/core"
import {
  interruptible as statusInterruptible,
  uninterruptible as statusUninterruptible
} from "../Fiber/core"
import type { FiberID } from "../Fiber/id"
import {
  chain_,
  checkInterruptible,
  foldCauseM_,
  halt,
  haltWith,
  interruptStatus,
  interruptStatus_,
  succeed
} from "./core"
import { forkDaemon } from "./core-scope"
import type { Effect } from "./effect"
import { fiberId } from "./fiberId"

/**
 * Performs this effect uninterruptibly. This will prevent the effect from
 * being terminated externally, but the effect may fail for internal reasons
 * (e.g. an uncaught error) or terminate due to defect.
 *
 * Uninterruptible effects may recover from all failure causes (including
 * interruption of an inner effect that has been made interruptible).
 */
export const uninterruptible = interruptStatus(statusUninterruptible)

/**
 * Used to restore the inherited interruptibility
 */
export interface InterruptStatusRestore {
  readonly restore: <R, E, A>(effect: Effect<R, E, A>) => Effect<R, E, A>
  readonly force: <R, E, A>(effect: Effect<R, E, A>) => Effect<R, E, A>
}

export class InterruptStatusRestoreImpl implements InterruptStatusRestore {
  constructor(readonly flag: InterruptStatus) {
    this.restore = this.restore.bind(this)
    this.force = this.force.bind(this)
  }

  restore<R, E, A>(effect: Effect<R, E, A>): Effect<R, E, A> {
    return interruptStatus_(effect, this.flag)
  }

  force<R, E, A>(effect: Effect<R, E, A>): Effect<R, E, A> {
    if (this.flag.isUninteruptible) {
      return interruptible(disconnect(uninterruptible(effect)))
    }
    return interruptStatus_(effect, this.flag)
  }
}

/**
 * Makes the effect uninterruptible, but passes it a restore function that
 * can be used to restore the inherited interruptibility from whatever region
 * the effect is composed into.
 */
export function uninterruptibleMask<R, E, A>(
  f: (restore: InterruptStatusRestore) => Effect<R, E, A>
) {
  return checkInterruptible((flag) =>
    uninterruptible(f(new InterruptStatusRestoreImpl(flag)))
  )
}

/**
 * Calls the specified function, and runs the effect it returns, if this
 * effect is interrupted.
 */
export function onInterrupt_<R, E, A, R2>(
  self: Effect<R, E, A>,
  cleanup: (interruptors: ReadonlySet<FiberID>) => Effect<R2, never, any>
) {
  return uninterruptibleMask(({ restore }) =>
    foldCauseM_(
      restore(self),
      (cause) =>
        Cause.interrupted(cause)
          ? chain_(cleanup(Cause.interruptors(cause)), () => halt(cause))
          : halt(cause),
      succeed
    )
  )
}

/**
 * Calls the specified function, and runs the effect it returns, if this
 * effect is interrupted (allows for expanding error).
 */
export function onInterruptExtended_<R, E, A, R2, E2>(
  self: Effect<R, E, A>,
  cleanup: () => Effect<R2, E2, any>
) {
  return uninterruptibleMask(({ restore }) =>
    foldCauseM_(
      restore(self),
      (cause) =>
        Cause.interrupted(cause)
          ? foldCauseM_(
              cleanup(),
              (_) => halt(_),
              () => halt(cause)
            )
          : halt(cause),
      succeed
    )
  )
}

/**
 * Calls the specified function, and runs the effect it returns, if this
 * effect is interrupted.
 */
export function onInterrupt<R2>(
  cleanup: (interruptors: ReadonlySet<FiberID>) => Effect<R2, never, any>
) {
  return <R, E, A>(self: Effect<R, E, A>) => onInterrupt_(self, cleanup)
}

/**
 * Returns an effect whose interruption will be disconnected from the
 * fiber's own interruption, being performed in the background without
 * slowing down the fiber's interruption.
 *
 * This method is useful to create "fast interrupting" effects. For
 * example, if you call this on a bracketed effect, then even if the
 * effect is "stuck" in acquire or release, its interruption will return
 * immediately, while the acquire / release are performed in the
 * background.
 *
 * See timeout and race for other applications.
 */
export function disconnect<R, E, A>(effect: Effect<R, E, A>) {
  return uninterruptibleMask(({ restore }) =>
    chain_(fiberId(), (id) =>
      chain_(forkDaemon(restore(effect)), (fiber) =>
        onInterrupt_(restore(Fiber.join(fiber)), () =>
          forkDaemon(fiber.interruptAs(id))
        )
      )
    )
  )
}

/**
 * Makes the effect interruptible, but passes it a restore function that
 * can be used to restore the inherited interruptibility from whatever region
 * the effect is composed into.
 */
export function interruptibleMask<R, E, A>(
  f: (restore: InterruptStatusRestore) => Effect<R, E, A>
) {
  return checkInterruptible((flag) =>
    interruptible(f(new InterruptStatusRestoreImpl(flag)))
  )
}

/**
 * Returns an effect that is interrupted as if by the specified fiber.
 */
export function interruptAs(fiberId: FiberID) {
  return haltWith((trace) => Cause.traced(Cause.interrupt(fiberId), trace()))
}

/**
 * Returns an effect that is interrupted by the current fiber
 */
export const interrupt = chain_(fiberId(), interruptAs)

/**
 * Returns a new effect that performs the same operations as this effect, but
 * interruptibly, even if composed inside of an uninterruptible region.
 *
 * Note that effects are interruptible by default, so this function only has
 * meaning if used within an uninterruptible region.
 *
 * WARNING: This operator "punches holes" into effects, allowing them to be
 * interrupted in unexpected places. Do not use this operator unless you know
 * exactly what you are doing. Instead, you should use `uninterruptibleMask`.
 */
export function interruptible<R, E, A>(effect: Effect<R, E, A>) {
  return interruptStatus_(effect, statusInterruptible)
}
