// tracing: off

import { accessCallTrace, traceAs, traceFrom } from "@effect-ts/tracing-utils"

import type { Cause } from "../Cause/cause"
import { keepDefects } from "../Cause/core"
import * as Exit from "../Exit/core"
import type * as Fiber from "../Fiber"
import { identity } from "../Function"
import * as O from "../Option"
import type { Supervisor } from "../Supervisor"
import type { Effect, IO, RIO, UIO } from "./effect"
import type { FailureReporter } from "./primitives"
import {
  ICheckInterrupt,
  ICheckTracingStatus,
  IDescriptor,
  IEffectAsync,
  IEffectPartial,
  IEffectTotal,
  IFail,
  IFlatMap,
  IFold,
  IFork,
  IInterruptStatus,
  IPlatform,
  IProvide,
  IRead,
  ISucceed,
  ISupervise,
  ISuspend,
  ISuspendPartial,
  ITrace,
  ITracingStatus,
  IYield
} from "./primitives"

/**
 * Effectfully accesses the environment of the effect.
 *
 * @trace 0
 */
export function access<R0, A>(f: (_: R0) => A): RIO<R0, A> {
  return new IRead(traceAs(f, (_: R0) => new ISucceed(f(_))))
}

/**
 * Effectfully accesses the environment of the effect.
 *
 * @trace 0
 */
export function accessM<R0, R, E, A>(
  f: (_: R0) => Effect<R, E, A>
): Effect<R & R0, E, A> {
  return new IRead(f)
}

/**
 * Returns an effect that models the execution of this effect, followed by
 * the passing of its value to the specified continuation function `f`,
 * followed by the effect that it returns.
 *
 * @dataFirst chain_
 */
export function chain<R1, E1, A1, A>(
  f: (a: A) => Effect<R1, E1, A1>,
  __trace?: string
) {
  return <R, E>(val: Effect<R, E, A>): Effect<R & R1, E | E1, A1> =>
    new IFlatMap(val, f, __trace)
}

/**
 * Returns an effect that models the execution of this effect, followed by
 * the passing of its value to the specified continuation function `f`,
 * followed by the effect that it returns.
 */
export function chain_<R, E, A, R1, E1, A1>(
  val: Effect<R, E, A>,
  f: (a: A) => Effect<R1, E1, A1>,
  __trace?: string
): Effect<R & R1, E | E1, A1> {
  return new IFlatMap(val, f, __trace)
}

/**
 * Constructs an effect based on information about the current fiber, such as
 * its identity.
 *
 * @trace 0
 */
export function descriptorWith<R, E, A>(
  f: (_: Fiber.Descriptor) => Effect<R, E, A>
): Effect<R, E, A> {
  return new IDescriptor(f)
}

/**
 * Checks the interrupt status, and produces the effect returned by the
 * specified callback.
 *
 * @trace 0
 */
export function checkInterruptible<R, E, A>(
  f: (_: Fiber.InterruptStatus) => Effect<R, E, A>
): Effect<R, E, A> {
  return new ICheckInterrupt(f)
}

/**
 * Capture trace at the current point
 */
export const trace: UIO<Fiber.Trace> = new ITrace()

/**
 * Checks the tracing status, and produces the effect returned by the
 * specified callback.
 */
export function checkTraced<R, E, A>(
  f: (_: boolean) => Effect<R, E, A>
): Effect<R, E, A> {
  return new ICheckTracingStatus(f)
}

/**
 * Disables Effect tracing facilities for the duration of the effect.
 *
 * Note: Effect tracing is cached, as such after the first iteration
 * it has a negligible effect on performance of hot-spots (Additional
 * hash map lookup per flatMap). As such, using `untraced` sections
 * is not guaranteed to result in a noticeable performance increase.
 */
export function untraced<R, E, A>(self: Effect<R, E, A>): Effect<R, E, A> {
  return new ITracingStatus(self, false)
}

/**
 * Enables Effect tracing for this effect. Because this is the default, this
 * operation only has an additional meaning if the effect is located within
 * an `untraced` section, or the current fiber has been spawned by a parent
 * inside an `untraced` section.
 */
export function traced<R, E, A>(self: Effect<R, E, A>): Effect<R, E, A> {
  return new ITracingStatus(self, true)
}

/**
 * Imports an asynchronous effect into a pure `Effect` value, possibly returning
 * the value synchronously.
 *
 * If the register function returns a value synchronously, then the callback
 * function `AsyncRE<R, E, A> => void` must not be called. Otherwise the callback
 * function must be called at most once.
 *
 * The list of fibers, that may complete the async callback, is used to
 * provide better diagnostics.
 *
 * @trace 0
 */
export function effectAsyncOption<R, E, A>(
  register: (cb: (_: Effect<R, E, A>) => void) => O.Option<Effect<R, E, A>>,
  blockingOn: readonly Fiber.FiberID[] = []
): Effect<R, E, A> {
  return new IEffectAsync(register, blockingOn)
}

/**
 * Imports a synchronous side-effect into a pure value, translating any
 * thrown exceptions into typed failed effects creating with `halt`.
 *
 * @trace 0
 * @trace 1
 */
export function effectPartial<E, A>(
  effect: () => A,
  onThrow: (u: unknown) => E
): IO<E, A> {
  return new IEffectPartial(effect, onThrow)
}

/**
 * Imports a synchronous side-effect into a pure value, translating any
 * thrown exceptions into typed failed effects creating with `halt`.
 *
 * @trace 0
 */
function try_<A>(effect: () => A): IO<unknown, A> {
  return new IEffectPartial(effect, identity)
}

export { try_ as try }

/**
 * Imports a synchronous side-effect into a pure value
 */
export function effectTotal<A>(effect: () => A, __trace?: string): UIO<A> {
  return new IEffectTotal(effect, __trace)
}

/**
 * A more powerful version of `foldM` that allows recovering from any kind of failure except interruptions.
 *
 * @dataFirst foldCauseM_
 */
export function foldCauseM<E, A, R2, E2, A2, R3, E3, A3>(
  failure: (cause: Cause<E>) => Effect<R2, E2, A2>,
  success: (a: A) => Effect<R3, E3, A3>,
  __trace?: string
) {
  return <R>(value: Effect<R, E, A>): Effect<R & R2 & R3, E2 | E3, A2 | A3> =>
    new IFold(value, failure, success, __trace)
}

/**
 * A more powerful version of `foldM` that allows recovering from any kind of failure except interruptions.
 */
export function foldCauseM_<R, E, A, R2, E2, A2, R3, E3, A3>(
  value: Effect<R, E, A>,
  failure: (cause: Cause<E>) => Effect<R2, E2, A2>,
  success: (a: A) => Effect<R3, E3, A3>,
  __trace?: string
): Effect<R & R2 & R3, E2 | E3, A2 | A3> {
  return new IFold(value, failure, success, __trace)
}

/**
 * Returns an effect that forks this effect into its own separate fiber,
 * returning the fiber immediately, without waiting for it to begin
 * executing the effect.
 *
 * The returned fiber can be used to interrupt the forked fiber, await its
 * result, or join the fiber. See `Fiber` for more information.
 *
 * The fiber is forked with interrupt supervision mode, meaning that when the
 * fiber that forks the child exits, the child will be interrupted.
 */
export function fork<R, E, A>(
  value: Effect<R, E, A>
): RIO<R, Fiber.FiberContext<E, A>> {
  return new IFork(value, O.none, O.none)
}

/**
 * Returns an effect that forks this effect into its own separate fiber,
 * returning the fiber immediately, without waiting for it to begin
 * executing the effect.
 *
 * The returned fiber can be used to interrupt the forked fiber, await its
 * result, or join the fiber. See `Fiber` for more information.
 *
 * The fiber is forked with interrupt supervision mode, meaning that when the
 * fiber that forks the child exits, the child will be interrupted.
 *
 * @dataFirst forkReport_
 */
export function forkReport(reportFailure: FailureReporter) {
  return <R, E, A>(value: Effect<R, E, A>): RIO<R, Fiber.FiberContext<E, A>> =>
    new IFork(value, O.none, O.some(reportFailure))
}

/**
 * Returns an effect that forks this effect into its own separate fiber,
 * returning the fiber immediately, without waiting for it to begin
 * executing the effect.
 *
 * The returned fiber can be used to interrupt the forked fiber, await its
 * result, or join the fiber. See `Fiber` for more information.
 *
 * The fiber is forked with interrupt supervision mode, meaning that when the
 * fiber that forks the child exits, the child will be interrupted.
 */
export function forkReport_<R, E, A>(
  value: Effect<R, E, A>,
  reportFailure: FailureReporter
): RIO<R, Fiber.FiberContext<E, A>> {
  return new IFork(value, O.none, O.some(reportFailure))
}

/**
 * Returns an effect that models failure with the specified `Cause`.
 *
 * @trace call
 */
export function halt<E>(cause: Cause<E>): IO<E, never> {
  const trace = accessCallTrace()
  return new IFail(traceFrom(trace, () => cause))
}

/**
 * Returns an effect that models failure with the specified `Cause`.
 *
 * This version takes in a lazily-evaluated trace that can be attached to the `Cause`
 * via `Cause.Traced`.
 */
export function haltWith<E>(
  cause: (_: () => Fiber.Trace) => Cause<E>,
  __trace?: string
): IO<E, never> {
  return new IFail(cause, __trace)
}

/**
 * Switches the interrupt status for this effect. If `true` is used, then the
 * effect becomes interruptible (the default), while if `false` is used, then
 * the effect becomes uninterruptible. These changes are compositional, so
 * they only affect regions of the effect.
 *
 * @dataFirst interruptStatus_
 */
export function interruptStatus(flag: Fiber.InterruptStatus) {
  return <R, E, A>(effect: Effect<R, E, A>): Effect<R, E, A> =>
    new IInterruptStatus(effect, flag)
}

/**
 * Switches the interrupt status for this effect. If `true` is used, then the
 * effect becomes interruptible (the default), while if `false` is used, then
 * the effect becomes uninterruptible. These changes are compositional, so
 * they only affect regions of the effect.
 */
export function interruptStatus_<R, E, A>(
  effect: Effect<R, E, A>,
  flag: Fiber.InterruptStatus
): Effect<R, E, A> {
  return new IInterruptStatus(effect, flag)
}

/**
 * Toggles Effect tracing support for this effect. If `true` is used, then the
 * effect will accumulate traces, while if `false` is used, then tracing
 * is disabled. These changes are compositional, so they only affect regions
 * of the effect.
 *
 * @dataFirst tracingStatus_
 */
export function tracingStatus(flag: boolean) {
  return <R, E, A>(effect: Effect<R, E, A>): Effect<R, E, A> =>
    new ITracingStatus(effect, flag)
}

/**
 * Toggles Effect tracing support for this effect. If `true` is used, then the
 * effect will accumulate traces, while if `false` is used, then tracing
 * is disabled. These changes are compositional, so they only affect regions
 * of the effect.
 */
export function tracingStatus_<R, E, A>(
  effect: Effect<R, E, A>,
  flag: boolean
): Effect<R, E, A> {
  return new ITracingStatus(effect, flag)
}

/**
 * Provides the `Effect` effect with its required environment, which eliminates
 * its dependency on `R`.
 *
 * @dataFirst provideAll_
 */
export function provideAll<R>(r: R) {
  return <E, A>(next: Effect<R, E, A>): Effect<unknown, E, A> => new IProvide(r, next)
}

/**
 * Provides the `Effect` effect with its required environment, which eliminates
 * its dependency on `R`.
 */
export function provideAll_<R, E, A>(
  next: Effect<R, E, A>,
  r: R
): Effect<unknown, E, A> {
  return new IProvide(r, next)
}

/**
 * Returns an effect that semantically runs the effect on a fiber,
 * producing an `Exit` for the completion value of the fiber.
 */
export function result<R, E, A>(
  value: Effect<R, E, A>
): Effect<R, never, Exit.Exit<E, A>> {
  return new IFold(
    value,
    (cause) => succeed(Exit.halt(cause)),
    (succ) => succeed(Exit.succeed(succ))
  )
}

/**
 * Lift a pure value into an effect
 */
export function succeed<A>(a: A, __trace?: string): Effect<unknown, never, A> {
  return new ISucceed(a, __trace)
}

/**
 * Returns an effect with the behavior of this one, but where all child
 * fibers forked in the effect are reported to the specified supervisor.
 */
export function supervised(supervisor: Supervisor<any>) {
  return <R, E, A>(fa: Effect<R, E, A>): Effect<R, E, A> =>
    new ISupervise(fa, supervisor)
}

/**
 * Returns a lazily constructed effect, whose construction may itself require effects.
 * When no environment is required (i.e., when R == unknown) it is conceptually equivalent to `flatten(effectTotal(io))`.
 *
 * @trace 0
 */
export function suspend<R, E, A>(factory: () => Effect<R, E, A>): Effect<R, E, A> {
  return new ISuspend(factory)
}

/**
 * Returns a lazily constructed effect, whose construction may itself require effects.
 * When no environment is required (i.e., when R == unknown) it is conceptually equivalent to `flatten(effectPartial(orThrow, io))`.
 *
 * @trace 0
 * @trace 1
 */
export function suspendPartial<R, E, A, E2>(
  factory: () => Effect<R, E, A>,
  onThrow: (u: unknown) => E2
): Effect<R, E | E2, A> {
  return new ISuspendPartial(factory, onThrow)
}

/**
 * Executed `that` in case `self` fails with a `Cause` that doesn't contain defects,
 * executes `success` in case of successes
 *
 * @trace 1
 * @trace 2
 */
export function tryOrElse_<R, E, A, R2, E2, A2, R3, E3, A3>(
  self: Effect<R, E, A>,
  that: () => Effect<R2, E2, A2>,
  success: (a: A) => Effect<R3, E3, A3>
): Effect<R & R2 & R3, E2 | E3, A2 | A3> {
  return new IFold(
    self,
    traceAs(that, (cause) => O.fold_(keepDefects(cause), that, halt)),
    success
  )
}

/**
 * Executed `that` in case `self` fails with a `Cause` that doesn't contain defects,
 * executes `success` in case of successes
 *
 * @dataFirst tryOrElse_
 * @trace 0
 * @trace 1
 */
export function tryOrElse<A, R2, E2, A2, R3, E3, A3>(
  that: () => Effect<R2, E2, A2>,
  success: (a: A) => Effect<R3, E3, A3>
): <R, E>(self: Effect<R, E, A>) => Effect<R & R2 & R3, E2 | E3, A2 | A3> {
  return (self) => tryOrElse_(self, that, success)
}

/**
 * Returns the effect resulting from mapping the success of this effect to unit.
 */
export const unit: UIO<void> = new ISucceed(undefined)

/**
 * Returns an effect that yields to the runtime system, starting on a fresh
 * stack. Manual use of this method can improve fairness, at the cost of
 * overhead.
 */
export const yieldNow: UIO<void> = new IYield()

/**
 * Checks the current platform
 *
 * @trace 0
 */
export function checkPlatform<R, E, A>(
  f: (_: Fiber.Platform<unknown>) => Effect<R, E, A>
): Effect<R, E, A> {
  return new IPlatform(f)
}
