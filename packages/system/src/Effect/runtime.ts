// option
// cause
import { isTracingEnabled } from "@effect-ts/tracing-utils"

import * as Cause from "../Cause/core"
import type { Renderer } from "../Cause/pretty"
import { defaultRenderer, pretty } from "../Cause/pretty"
import type { Clock } from "../Clock/definition"
import { HasClock } from "../Clock/definition"
// exit
import type { Exit } from "../Exit/exit"
// fiber
import { FiberContext } from "../Fiber/context"
import type { Runtime as FiberRuntime } from "../Fiber/core"
import { interruptible } from "../Fiber/core"
import { newFiberId } from "../Fiber/id"
import { Platform } from "../Fiber/platform"
import type { Callback } from "../Fiber/state"
import { constVoid, identity, literal } from "../Function"
import { none } from "../Option"
import { defaultRandom, HasRandom } from "../Random"
import * as Scope from "../Scope"
// supervisor
import * as Supervisor from "../Supervisor"
import { sync } from "../Sync/core"
import { accessM, chain_, effectTotal, succeed, unit } from "./core"
import type { Effect, UIO } from "./effect"
import { _I } from "./effect"
import { effectAsyncInterrupt } from "./effectAsyncInterrupt"
import type { FailureReporter } from "./primitives"

// empty function
const empty = () => {
  //
}

export type DefaultEnv = HasClock & HasRandom

//
// Live Clock Implementation
//
export const LiveClock: Clock = {
  _tag: literal("@effect-ts/system/Clock"),
  currentTime: sync(() => new Date().getTime()),
  sleep: (ms) =>
    effectAsyncInterrupt((cb) => {
      const timeout = setTimeout(() => {
        cb(unit)
      }, ms)

      return effectTotal(() => {
        clearTimeout(timeout)
      })
    })
}

export function defaultEnv(): DefaultEnv {
  return {
    [HasClock.key]: LiveClock,
    [HasRandom.key]: defaultRandom
  } as any
}

/**
 * Effect Canceler
 */
export type AsyncCancel<E, A> = UIO<Exit<E, A>>

export const prettyReporter: FailureReporter = (e) => {
  console.error(pretty(e, defaultRenderer))
}

export const defaultPlatform = new Platform(
  25,
  25,
  isTracingEnabled(),
  isTracingEnabled(),
  isTracingEnabled(),
  isTracingEnabled(),
  25,
  25,
  25,
  defaultRenderer,
  constVoid,
  10_000
)

export class CustomRuntime<R> {
  constructor(readonly env: R, readonly platform: Platform) {
    this.traceExecution = this.traceExecution.bind(this)
    this.traceExecutionLength = this.traceExecutionLength.bind(this)
    this.traceStack = this.traceStack.bind(this)
    this.traceStackLength = this.traceStackLength.bind(this)
    this.traceEffect = this.traceEffect.bind(this)
    this.initialTracingStatus = this.initialTracingStatus.bind(this)
    this.ancestorExecutionTraceLength = this.ancestorExecutionTraceLength.bind(this)
    this.ancestorStackTraceLength = this.ancestorStackTraceLength.bind(this)
    this.ancestryLength = this.ancestryLength.bind(this)
    this.fiberContext = this.fiberContext.bind(this)
    this.run = this.run.bind(this)
    this.runAsap = this.runAsap.bind(this)
    this.runCancel = this.runCancel.bind(this)
    this.runPromise = this.runPromise.bind(this)
    this.runPromiseExit = this.runPromiseExit.bind(this)
    this.traceRenderer = this.traceRenderer.bind(this)
    this.runFiber = this.runFiber.bind(this)
  }

  fiberContext<E, A>() {
    const initialIS = interruptible
    const fiberId = newFiberId()
    const scope = Scope.unsafeMakeScope<Exit<E, A>>()
    const supervisor = Supervisor.none

    const context = new FiberContext<E, A>(
      fiberId,
      this.env,
      initialIS,
      new Map(),
      supervisor,
      scope,
      this.platform.maxOp,
      this.platform.reportFailure,
      this.platform,
      none
    )

    return context
  }

  runFiber<E, A>(self: Effect<R, E, A>): FiberRuntime<E, A> {
    const context = this.fiberContext<E, A>()
    context.evaluateLater(self[_I])
    return context
  }

  /**
   * Runs effect until completion, calling cb with the eventual exit state
   */
  run<E, A>(_: Effect<R, E, A>, cb?: Callback<E, A>) {
    const context = this.fiberContext<E, A>()

    context.evaluateLater(_[_I])
    context.runAsync(cb || empty)
  }

  /**
   * Runs effect until completion, calling cb with the eventual exit state
   */
  runAsap<E, A>(_: Effect<R, E, A>, cb?: Callback<E, A>) {
    const context = this.fiberContext<E, A>()

    context.evaluateNow(_[_I])
    context.runAsync(cb || empty)
  }

  /**
   * Runs effect until completion returing a cancel effecr that when executed
   * triggers cancellation of the process
   */
  runCancel<E, A>(_: Effect<R, E, A>, cb?: Callback<E, A>): AsyncCancel<E, A> {
    const context = this.fiberContext<E, A>()

    context.evaluateLater(_[_I])
    context.runAsync(cb || empty)

    return context.interruptAs(context.id)
  }

  /**
   * Run effect as a Promise, throwing a the first error or exception
   */
  runPromise<E, A>(_: Effect<R, E, A>): Promise<A> {
    const context = this.fiberContext<E, A>()

    context.evaluateLater(_[_I])

    return new Promise((res, rej) => {
      context.runAsync((exit) => {
        switch (exit._tag) {
          case "Success": {
            res(exit.value)
            break
          }
          case "Failure": {
            rej(Cause.squash(identity)(exit.cause))
            break
          }
        }
      })
    })
  }

  /**
   * Run effect as a Promise of the Exit state
   * in case of error.
   */
  runPromiseExit<E, A>(_: Effect<R, E, A>): Promise<Exit<E, A>> {
    const context = this.fiberContext<E, A>()

    context.evaluateLater(_[_I])

    return new Promise((res) => {
      context.runAsync((exit) => {
        res(exit)
      })
    })
  }

  withEnvironment<R2>(f: (_: R) => R2) {
    return new CustomRuntime(f(this.env), this.platform)
  }

  traceRenderer(renderer: Renderer) {
    return new CustomRuntime(
      this.env,
      new Platform(
        this.platform.executionTraceLength,
        this.platform.stackTraceLength,
        this.platform.traceExecution,
        this.platform.traceStack,
        this.platform.traceEffects,
        this.platform.initialTracingStatus,
        this.platform.ancestorExecutionTraceLength,
        this.platform.ancestorStackTraceLength,
        this.platform.ancestryLength,
        renderer,
        this.platform.reportFailure,
        this.platform.maxOp
      )
    )
  }

  traceExecution(b: boolean) {
    return new CustomRuntime(
      this.env,
      new Platform(
        this.platform.executionTraceLength,
        this.platform.stackTraceLength,
        b,
        this.platform.traceStack,
        this.platform.traceEffects,
        this.platform.initialTracingStatus,
        this.platform.ancestorExecutionTraceLength,
        this.platform.ancestorStackTraceLength,
        this.platform.ancestryLength,
        this.platform.renderer,
        this.platform.reportFailure,
        this.platform.maxOp
      )
    )
  }

  traceExecutionLength(n: number) {
    return new CustomRuntime(
      this.env,
      new Platform(
        n,
        this.platform.stackTraceLength,
        this.platform.traceExecution,
        this.platform.traceStack,
        this.platform.traceEffects,
        this.platform.initialTracingStatus,
        this.platform.ancestorExecutionTraceLength,
        this.platform.ancestorStackTraceLength,
        this.platform.ancestryLength,
        this.platform.renderer,
        this.platform.reportFailure,
        this.platform.maxOp
      )
    )
  }

  traceStack(b: boolean) {
    return new CustomRuntime(
      this.env,
      new Platform(
        this.platform.executionTraceLength,
        this.platform.stackTraceLength,
        this.platform.traceExecution,
        b,
        this.platform.traceEffects,
        this.platform.initialTracingStatus,
        this.platform.ancestorExecutionTraceLength,
        this.platform.ancestorStackTraceLength,
        this.platform.ancestryLength,
        this.platform.renderer,
        this.platform.reportFailure,
        this.platform.maxOp
      )
    )
  }

  traceStackLength(n: number) {
    return new CustomRuntime(
      this.env,
      new Platform(
        this.platform.executionTraceLength,
        n,
        this.platform.traceExecution,
        this.platform.traceStack,
        this.platform.traceEffects,
        this.platform.initialTracingStatus,
        this.platform.ancestorExecutionTraceLength,
        this.platform.ancestorStackTraceLength,
        this.platform.ancestryLength,
        this.platform.renderer,
        this.platform.reportFailure,
        this.platform.maxOp
      )
    )
  }

  traceEffect(b: boolean) {
    return new CustomRuntime(
      this.env,
      new Platform(
        this.platform.executionTraceLength,
        this.platform.stackTraceLength,
        this.platform.traceExecution,
        this.platform.traceStack,
        b,
        this.platform.initialTracingStatus,
        this.platform.ancestorExecutionTraceLength,
        this.platform.ancestorStackTraceLength,
        this.platform.ancestryLength,
        this.platform.renderer,
        this.platform.reportFailure,
        this.platform.maxOp
      )
    )
  }

  initialTracingStatus(b: boolean) {
    return new CustomRuntime(
      this.env,
      new Platform(
        this.platform.executionTraceLength,
        this.platform.stackTraceLength,
        this.platform.traceExecution,
        this.platform.traceStack,
        this.platform.traceEffects,
        b,
        this.platform.ancestorExecutionTraceLength,
        this.platform.ancestorStackTraceLength,
        this.platform.ancestryLength,
        this.platform.renderer,
        this.platform.reportFailure,
        this.platform.maxOp
      )
    )
  }

  ancestorExecutionTraceLength(n: number) {
    return new CustomRuntime(
      this.env,
      new Platform(
        this.platform.executionTraceLength,
        this.platform.stackTraceLength,
        this.platform.traceExecution,
        this.platform.traceStack,
        this.platform.traceEffects,
        this.platform.initialTracingStatus,
        n,
        this.platform.ancestorStackTraceLength,
        this.platform.ancestryLength,
        this.platform.renderer,
        this.platform.reportFailure,
        this.platform.maxOp
      )
    )
  }

  ancestorStackTraceLength(n: number) {
    return new CustomRuntime(
      this.env,
      new Platform(
        this.platform.executionTraceLength,
        this.platform.stackTraceLength,
        this.platform.traceExecution,
        this.platform.traceStack,
        this.platform.traceEffects,
        this.platform.initialTracingStatus,
        this.platform.ancestorExecutionTraceLength,
        n,
        this.platform.ancestryLength,
        this.platform.renderer,
        this.platform.reportFailure,
        this.platform.maxOp
      )
    )
  }

  ancestryLength(n: number) {
    return new CustomRuntime(
      this.env,
      new Platform(
        this.platform.executionTraceLength,
        this.platform.stackTraceLength,
        this.platform.traceExecution,
        this.platform.traceStack,
        this.platform.traceEffects,
        this.platform.initialTracingStatus,
        this.platform.ancestorExecutionTraceLength,
        this.platform.ancestorStackTraceLength,
        n,
        this.platform.renderer,
        this.platform.reportFailure,
        this.platform.maxOp
      )
    )
  }

  reportFailure(reportFailure: (_: Cause.Cause<unknown>) => void) {
    return new CustomRuntime(
      this.env,
      new Platform(
        this.platform.executionTraceLength,
        this.platform.stackTraceLength,
        this.platform.traceExecution,
        this.platform.traceStack,
        this.platform.traceEffects,
        this.platform.initialTracingStatus,
        this.platform.ancestorExecutionTraceLength,
        this.platform.ancestorStackTraceLength,
        this.platform.ancestryLength,
        this.platform.renderer,
        reportFailure,
        this.platform.maxOp
      )
    )
  }

  maxOp(maxOp: number) {
    return new CustomRuntime(
      this.env,
      new Platform(
        this.platform.executionTraceLength,
        this.platform.stackTraceLength,
        this.platform.traceExecution,
        this.platform.traceStack,
        this.platform.traceEffects,
        this.platform.initialTracingStatus,
        this.platform.ancestorExecutionTraceLength,
        this.platform.ancestorStackTraceLength,
        this.platform.ancestryLength,
        this.platform.renderer,
        this.platform.reportFailure,
        maxOp
      )
    )
  }
}

/**
 * Construct custom runtime
 */
export function makeCustomRuntime<R>(env: R, platform: Platform) {
  return new CustomRuntime(env, platform)
}

/**
 * Default runtime
 */
export const defaultRuntime = makeCustomRuntime(defaultEnv(), defaultPlatform)

/**
 * Exports of default runtime
 */
export const {
  fiberContext,
  run,
  runAsap,
  runCancel,
  runFiber,
  runPromise,
  runPromiseExit
} = defaultRuntime

/**
 * Use current environment to build a runtime that is capable of
 * providing its content to other effects.
 *
 * NOTE: in should be used in a region where current environment
 * is valid (i.e. keep attention to closed resources)
 */
export function runtime<R0>() {
  return accessM((r0: R0) =>
    effectTotal(
      (): CustomRuntime<R0> => {
        return makeCustomRuntime<R0>(r0, defaultPlatform)
      }
    )
  )
}

export function withRuntimeM<R0, R, E, A>(
  f: (r: CustomRuntime<R0>) => Effect<R, E, A>
) {
  return chain_(runtime<R0>(), f)
}

export function withRuntime<R0, A>(f: (r: CustomRuntime<R0>) => A) {
  return chain_(runtime<R0>(), (r) => succeed(f(r)))
}
