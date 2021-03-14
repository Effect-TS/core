// tracing: off

import "../Operator"

/**
 * Ported from https://github.com/zio/zio/blob/master/core/shared/src/main/scala/zio/Clock.scala
 *
 * Copyright 2020 Michael Arnaldi and the Matechs Garage Contributors.
 */
import { effectTotal, unit } from "../Effect/core"
import type { Effect, UIO } from "../Effect/effect"
import { effectAsyncInterrupt } from "../Effect/effectAsyncInterrupt"
import { accessService, accessServiceM, provideServiceM } from "../Effect/has"
import { literal } from "../Function"
import type { Has, HasTag, Tag } from "../Has"
import { tag } from "../Has"

//
// Clock Definition
//
export abstract class Clock {
  readonly _tag = literal("@effect-ts/system/Clock")

  abstract readonly currentTime: UIO<number>
  abstract readonly sleep: (ms: number, __trace?: string) => UIO<void>
}

//
// Has Clock
//
export const HasClock = tag(Clock)

export type HasClock = HasTag<typeof HasClock>

//
// Live Clock Implementation
//
export class LiveClock extends Clock {
  currentTime: UIO<number> = effectTotal(() => new Date().getTime())

  sleep: (ms: number, __trace?: string) => UIO<void> = (ms, trace) =>
    effectAsyncInterrupt((cb) => {
      const timeout = setTimeout(() => {
        cb(unit)
      }, ms)

      return effectTotal(() => {
        clearTimeout(timeout)
      })
    }, trace)
}

//
// Proxy Clock Implementation
//
export class ProxyClock extends Clock {
  constructor(
    readonly currentTime: UIO<number>,
    readonly sleep: (ms: number, __trace?: string) => UIO<void>
  ) {
    super()
  }
}

/**
 * Get the current time in ms since epoch
 */
export const currentTime = accessServiceM(HasClock)((_) => _.currentTime)

/**
 * Sleeps for the provided amount of ms
 */
export function sleep(ms: number, __trace?: string) {
  return accessServiceM(HasClock)((_) => _.sleep(ms, __trace))
}

/**
 * Access clock from environment
 */
export const withClockM = accessServiceM(HasClock)

/**
 * Access clock from environment
 */
export const withClock = accessService(HasClock)

//
// TestClock
//
export class TestClock extends Clock {
  private time = new Date().getTime()

  readonly currentTime: UIO<number> = effectTotal(() => this.time)

  readonly sleep: (ms: number) => UIO<void> = () => unit

  readonly advance = (ms: number) =>
    effectTotal(() => {
      this.time = this.time + ms
    })

  static advance = (ms: number) => accessServiceM(HasTestClock)((_) => _.advance(ms))
}

/**
 * Accesses the TestClock
 */
export const HasTestClock: Tag<TestClock> = tag<TestClock>().setKey(HasClock.key)

// @ts-expect-error
export const provideTestClock: <R1, E1, A1>(
  ma: Effect<R1 & Has<TestClock> & Has<Clock>, E1, A1>
) => Effect<R1, E1, A1> = provideServiceM(HasTestClock)(
  effectTotal(() => new TestClock())
)
