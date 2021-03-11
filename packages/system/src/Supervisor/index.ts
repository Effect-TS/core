import "../Operator"

/**
 * Ported from https://github.com/zio/zio/blob/master/core/shared/src/main/scala/zio/Supervisor.scala
 *
 * Copyright 2020 Michael Arnaldi and the Matechs Garage Contributors.
 */
import { effectTotal, unit } from "../Effect/core"
import type { Effect, UIO } from "../Effect/effect"
import { zip_ } from "../Effect/zip"
import type { Exit } from "../Exit/exit"
import type { Runtime } from "../Fiber/core"
import { pipe } from "../Function"
import type * as O from "../Option"
import * as R from "../Ref"
import { AtomicReference } from "../Support/AtomicReference"

/**
 * A `Supervisor<A>` is allowed to supervise the launching and termination of
 * fibers, producing some visible value of type `A` from the supervision.
 */
export class Supervisor<A> {
  constructor(
    readonly value: UIO<A>,
    readonly unsafeOnStart: <R, E, A>(
      environment: R,
      effect: Effect<R, E, A>,
      parent: O.Option<Runtime<any, any>>,
      fiber: Runtime<E, A>
    ) => Propagation,
    readonly unsafeOnEnd: <E, A>(value: Exit<E, A>, fiber: Runtime<E, A>) => Propagation
  ) {}

  /**
   * Returns a new supervisor that performs the function of this supervisor,
   * and the function of the specified supervisor, producing a tuple of the
   * outputs produced by both supervisors.
   *
   * The composite supervisor indicates that it has fully handled the
   * supervision event if only both component supervisors indicate they have
   * handled the supervision event.
   */
  and<B>(that: Supervisor<B>): Supervisor<readonly [A, B]> {
    return new Supervisor(
      zip_(this.value, that.value),
      (environment, effect, parent, fiber) =>
        propagationAnd(
          this.unsafeOnStart(environment, effect, parent, fiber),
          that.unsafeOnStart(environment, effect, parent, fiber)
        ),
      (value, fiber) =>
        propagationAnd(this.unsafeOnEnd(value, fiber), that.unsafeOnEnd(value, fiber))
    )
  }

  /**
   * Returns a new supervisor that performs the function of this supervisor,
   * and the function of the specified supervisor, producing a tuple of the
   * outputs produced by both supervisors.
   *
   * The composite supervisor indicates that it has fully handled the
   * supervision event if either component supervisors indicate they have
   * handled the supervision event.
   */
  or<B>(that: Supervisor<B>): Supervisor<readonly [A, B]> {
    return new Supervisor(
      zip_(this.value, that.value),
      (environment, effect, parent, fiber) =>
        propagationOr(
          this.unsafeOnStart(environment, effect, parent, fiber),
          that.unsafeOnStart(environment, effect, parent, fiber)
        ),
      (value, fiber) =>
        propagationOr(this.unsafeOnEnd(value, fiber), that.unsafeOnEnd(value, fiber))
    )
  }
}

/**
 * A hint indicating whether or not to propagate supervision events across
 * supervisor hierarchies.
 */
export type Propagation = Stop | Continue

/**
 * A hint indicating supervision events no longer require propagation.
 */
export class Stop {
  readonly _tag = "Stop"
}

/**
 * A hint indicating supervision events require further propagation.
 */
export class Continue {
  readonly _tag = "Continue"
}

export const propagationAnd = (self: Propagation, that: Propagation) =>
  self._tag === "Continue" && that._tag === "Continue" ? _continue : _stop

export const propagationOr = (self: Propagation, that: Propagation) =>
  self._tag === "Continue" || that._tag === "Continue" ? _continue : _stop

export const _stop = new Stop()

export const _continue = new Continue()

export function unsafeTrack(
  set: Set<Runtime<any, any>> = new Set<Runtime<any, any>>()
) {
  return new Supervisor<readonly Runtime<any, any>[]>(
    effectTotal(() => Array.from(set)),
    (_, __, ___, fiber) => {
      set.add(fiber)
      return _continue
    },
    (_, fiber) => {
      set.delete(fiber)
      return _continue
    }
  )
}

export const mainFibers: Set<Runtime<any, any>> = new Set<Runtime<any, any>>()

function unsafeTrackMain() {
  const interval = new AtomicReference<NodeJS.Timeout | undefined>(undefined)

  return new Supervisor<Set<Runtime<any, any>>>(
    effectTotal(() => mainFibers),
    (_, __, ___, fiber) => {
      if (mainFibers.has(fiber)) {
        if (typeof interval.get === "undefined") {
          interval.set(
            setInterval(() => {
              // keep process alive
            }, 60000)
          )
        }
      }
      return _continue
    },
    (_, fiber) => {
      mainFibers.delete(fiber)
      if (mainFibers.size === 0) {
        const ci = interval.get

        if (ci) {
          clearInterval(ci)
        }
      }
      return _continue
    }
  )
}

export const trackMainFibers = unsafeTrackMain()

/**
 * Creates a new supervisor that tracks children in a set.
 */
export const track = effectTotal(() => unsafeTrack())

/**
 * Creates a new supervisor that tracks children in a set.
 */
export const fibersIn = (ref: R.Ref<Set<Runtime<any, any>>>) =>
  effectTotal(
    () =>
      new Supervisor(
        ref.get,
        (_, __, ___, fiber) => {
          pipe(
            ref,
            R.unsafeUpdate((s) => s.add(fiber))
          )
          return _continue
        },
        (_, fiber) => {
          pipe(
            ref,
            R.unsafeUpdate((s) => {
              s.delete(fiber)
              return s
            })
          )
          return _continue
        }
      )
  )

/**
 * A supervisor that doesn't do anything in response to supervision events.
 */
export const none = new Supervisor<void>(
  unit,
  () => _continue,
  () => _continue
)
