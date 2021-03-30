// tracing: off

import * as A from "../../Array"
import type { Cause } from "../../Cause"
import * as C from "../../Cause"
import { RuntimeError } from "../../Cause"
import type { HasClock } from "../../Clock"
import * as R from "../../Dictionary"
import type { Effect } from "../../Effect"
import * as T from "../../Effect"
import * as E from "../../Either"
import * as Ex from "../../Exit"
import type { FiberID } from "../../Fiber"
import * as F from "../../Fiber"
import { constVoid, identity, pipe, tuple } from "../../Function"
import { NoSuchElementException } from "../../GlobalExceptions"
import type { Has, Tag } from "../../Has"
import { mergeEnvironments } from "../../Has"
import * as I from "../../Iterable"
import * as L from "../../Layer"
import * as NA from "../../NonEmptyArray"
import type { Option } from "../../Option"
import * as O from "../../Option"
import type { HashSet } from "../../Persistent/HashSet"
import * as HS from "../../Persistent/HashSet"
import * as P from "../../Promise"
import type { Schedule } from "../../Schedule"
import { track } from "../../Supervisor"
import type { UnionToIntersection } from "../../Utils"
import * as core from "../core"
import * as forEach from "../forEach"
import { fromEffect } from "../fromEffect"
import { makeExit_ } from "../makeExit"
import type { IO, RIO, UIO } from "../managed"
import { Managed } from "../managed"
import type * as RM from "../ReleaseMap"
import * as add from "../ReleaseMap/add"
import * as makeReleaseMap from "../ReleaseMap/makeReleaseMap"
import * as releaseAll from "../ReleaseMap/releaseAll"
import { succeed } from "../succeed"
import { absolve } from "./absolve"
import { environment } from "./environment"
import { foldM_ } from "./foldM_"
import { gen } from "./gen"
import { halt } from "./halt"
import * as provideAll from "./provideAll"
import { releaseMap } from "./releaseMap"
import { suspend } from "./suspend"

/**
 * Attempts to convert defects into a failure, throwing away all information
 * about the cause of the failure.
 */
export function absorb<E>(f: (e: E) => unknown) {
  return <R, A>(self: Managed<R, E, A>) =>
    foldM_(sandbox(self), (c) => core.fail(C.squash(f)(c)), succeed)
}

/**
 * Unwraps the optional success of this effect, but can fail with None value.
 */
export function get<R, A>(self: Managed<R, never, O.Option<A>>) {
  return absolve(
    core.map_(
      self,
      E.fromOption(() => O.none)
    )
  )
}

/**
 * Returns an effect whose failure is mapped by the specified `f` function.
 */
export function mapError_<R, A, E, E2>(self: Managed<R, E, A>, f: (e: E) => E2) {
  return new Managed(T.mapError_(self.effect, f))
}

/**
 * Returns an effect whose failure is mapped by the specified `f` function.
 */
export function mapError<E, E2>(f: (e: E) => E2) {
  return <R, A>(self: Managed<R, E, A>) => mapError_(self, f)
}

/**
 * Returns an effect whose full failure is mapped by the specified `f` function.
 */
export function mapErrorCause_<R, A, E, E2>(
  self: Managed<R, E, A>,
  f: (e: C.Cause<E>) => C.Cause<E2>
) {
  return new Managed(T.mapErrorCause_(self.effect, f))
}

/**
 * Returns an effect whose full failure is mapped by the specified `f` function.
 */
export function mapErrorCause<E, E2>(f: (e: C.Cause<E>) => C.Cause<E2>) {
  return <R, A>(self: Managed<R, E, A>) => mapErrorCause_(self, f)
}

/**
 * Returns a memoized version of the specified managed.
 */
export function memoize<R, E, A>(self: Managed<R, E, A>): UIO<Managed<R, E, A>> {
  return core.mapM_(releaseMap, (finalizers) =>
    T.gen(function* (_) {
      const promise = yield* _(P.make<E, A>())
      const complete = yield* _(
        T.once(
          T.accessM((r: R) =>
            pipe(
              self.effect,
              T.provideAll(tuple(r, finalizers)),
              T.map(([_, a]) => a),
              T.to(promise)
            )
          )
        )
      )

      return pipe(complete, T.andThen(P.await(promise)), T.toManaged)
    })
  )
}

/**
 * Returns a new effect where the error channel has been merged into the
 * success channel to their common combined type.
 */
export function merge<R, E, A>(self: Managed<R, E, A>) {
  return foldM_(self, succeed, succeed)
}

/**
 * Returns the managed resulting from mapping the success of this managed to unit.
 */
export const unit = suspend(() => fromEffect(T.unit))

/**
 * Requires the option produced by this value to be `None`.
 */
export function none<R, E, A>(
  self: Managed<R, E, O.Option<A>>
): Managed<R, O.Option<E>, void> {
  return foldM_(
    self,
    (x) => pipe(x, O.some, core.fail),
    O.fold(
      () => unit,
      () => core.fail(O.none)
    )
  )
}

/**
 * Folds over the failure value or the success value to yield an effect that
 * does not fail, but succeeds with the value returned by the left or right
 * function passed to `fold`.
 */
export function fold_<R, E, A, B, C>(
  self: Managed<R, E, A>,
  onFail: (e: E) => B,
  onSuccess: (a: A) => C
) {
  return foldM_(
    self,
    (x) => pipe(x, onFail, succeed),
    (x) => pipe(x, onSuccess, succeed)
  )
}

/**
 * Folds over the failure value or the success value to yield an effect that
 * does not fail, but succeeds with the value returned by the left or right
 * function passed to `fold`.
 */
export function fold<E, A, B, C>(onFail: (e: E) => B, onSuccess: (a: A) => C) {
  return <R>(self: Managed<R, E, A>) => fold_(self, onFail, onSuccess)
}

/**
 * Executes this effect, skipping the error but returning optionally the success.
 */
export function option<R, E, A>(
  self: Managed<R, E, A>
): Managed<R, never, O.Option<A>> {
  return fold_(self, () => O.none, O.some)
}

/**
 * Converts an option on errors into an option on values.
 */
export function optional<R, E, A>(
  self: Managed<R, O.Option<E>, A>
): Managed<R, E, O.Option<A>> {
  return foldM_(
    self,
    O.fold(() => succeed(O.none), core.fail),
    (x) => pipe(x, O.some, succeed)
  )
}

/**
 * Keeps none of the errors, and terminates the fiber with them, using
 * the specified function to convert the `E` into a `Throwable`.
 */
export function orDieWith<E>(f: (e: E) => unknown) {
  return <R, A>(self: Managed<R, E, A>) => new Managed(T.orDieWith_(self.effect, f))
}

/**
 * Keeps none of the errors, and terminates the fiber with them, using
 * the specified function to convert the `E` into a `Throwable`.
 */
export function orDieWith_<R, E, A>(self: Managed<R, E, A>, f: (e: E) => unknown) {
  return new Managed(T.orDieWith_(self.effect, f))
}

/**
 * Translates effect failure into death of the fiber, making all failures unchecked and
 * not a part of the type of the effect.
 */
export function orDie<R, E, A>(self: Managed<R, E, A>) {
  return orDieWith_(self, identity)
}

/**
 * Executes this effect and returns its value, if it succeeds, but
 * otherwise executes the specified effect.
 */
export function orElse<R2, E2, A2>(that: () => Managed<R2, E2, A2>) {
  return <R, E, A>(self: Managed<R, E, A>) => orElse_(self, that)
}

/**
 * Executes this effect and returns its value, if it succeeds, but
 * otherwise executes the specified effect.
 */
export function orElse_<R, E, A, R2, E2, A2>(
  self: Managed<R, E, A>,
  that: () => Managed<R2, E2, A2>
) {
  return foldM_(self, () => that(), succeed)
}

/**
 * Executes this effect and returns its value, if it succeeds, but
 * otherwise fails with the specified error.
 */
export function orElseFail<E2>(e: E2) {
  return <R, E, A>(self: Managed<R, E, A>) => orElseFail_(self, e)
}

/**
 * Executes this effect and returns its value, if it succeeds, but
 * otherwise fails with the specified error.
 */
export function orElseFail_<R, E, A, E2>(self: Managed<R, E, A>, e: E2) {
  return orElse_(self, () => core.fail(e))
}

/**
 * Executes this effect and returns its value, if it succeeds, but
 * otherwise executes the specified effect.
 */
export function orElseEither<R2, E2, A2>(that: () => Managed<R2, E2, A2>) {
  return <R, E, A>(self: Managed<R, E, A>): Managed<R & R2, E2, E.Either<A2, A>> =>
    orElseEither_(self, that)
}

/**
 * Executes this effect and returns its value, if it succeeds, but
 * otherwise executes the specified effect.
 */
export function orElseEither_<R, E, A, R2, E2, A2>(
  self: Managed<R, E, A>,
  that: () => Managed<R2, E2, A2>
): Managed<R & R2, E2, E.Either<A2, A>> {
  return foldM_(
    self,
    () => core.map_(that(), E.left),
    (x) => pipe(x, E.right, succeed)
  )
}

/**
 * Returns an effect that will produce the value of this effect, unless it
 * fails with the `None` value, in which case it will produce the value of
 * the specified effect.
 */
export function orElseOptional_<R, E, A, R2, E2, A2>(
  self: Managed<R, O.Option<E>, A>,
  that: () => Managed<R2, O.Option<E2>, A2>
): Managed<R & R2, O.Option<E | E2>, A | A2> {
  return catchAll_(
    self,
    O.fold(
      () => that(),
      (e) => core.fail(O.some<E | E2>(e))
    )
  )
}

/**
 * Executes this effect and returns its value, if it succeeds, but
 * otherwise succeeds with the specified value.
 */
export function orElseSucceed_<R, E, A, A2>(
  self: Managed<R, O.Option<E>, A>,
  that: () => A2
): Managed<R, O.Option<E>, A | A2> {
  return orElse_(self, () => succeed(that()))
}

/**
 * Executes this effect and returns its value, if it succeeds, but
 * otherwise succeeds with the specified value.
 */
export function orElseSucceed<R, E, A, A2>(that: () => A2) {
  return (self: Managed<R, O.Option<E>, A>) => orElseSucceed_(self, that)
}

/**
 * Returns an effect that will produce the value of this effect, unless it
 * fails with the `None` value, in which case it will produce the value of
 * the specified effect.
 */
export function orElseOptional<R2, E2, A2>(that: () => Managed<R2, O.Option<E2>, A2>) {
  return <R, E, A>(self: Managed<R, O.Option<E>, A>) => orElseOptional_(self, that)
}

/**
 * Recovers from all errors.
 */
export function catchAll_<R, E, A, R2, E2, A2>(
  self: Managed<R, E, A>,
  f: (e: E) => Managed<R2, E2, A2>
) {
  return foldM_(self, f, succeed)
}

/**
 * Recovers from all errors.
 */
export function catchAll<E, R2, E2, A2>(f: (e: E) => Managed<R2, E2, A2>) {
  return <R, A>(self: Managed<R, E, A>) => catchAll_(self, f)
}

/**
 * Recovers from all errors with provided Cause.
 */
export function catchAllCause_<R, E, A, R2, E2, A2>(
  self: Managed<R, E, A>,
  f: (e: C.Cause<E>) => Managed<R2, E2, A2>
) {
  return core.foldCauseM_(self, f, succeed)
}

/**
 * Recovers from all errors with provided Cause.
 */
export function catchAllCause<E, R2, E2, A2>(
  f: (e: C.Cause<E>) => Managed<R2, E2, A2>
) {
  return <R, A>(self: Managed<R, E, A>) => core.foldCauseM_(self, f, succeed)
}

/**
 * Recovers from some or all of the error cases.
 */
export function catchSome_<R, E, A, R2, E2, A2>(
  self: Managed<R, E, A>,
  pf: (e: E) => O.Option<Managed<R2, E2, A2>>
): Managed<R & R2, E | E2, A | A2> {
  return catchAll_(self, (e) => O.getOrElse_(pf(e), () => core.fail<E | E2>(e)))
}

/**
 * Recovers from some or all of the error cases.
 */
export function catchSome<E, R2, E2, A2>(pf: (e: E) => O.Option<Managed<R2, E2, A2>>) {
  return <R, A>(self: Managed<R, E, A>) => catchSome_(self, pf)
}

/**
 * Recovers from some or all of the error cases.
 */
export function catchSomeCause_<R, E, A, R2, E2, A2>(
  self: Managed<R, E, A>,
  pf: (e: C.Cause<E>) => O.Option<Managed<R2, E2, A2>>
): Managed<R & R2, E | E2, A | A2> {
  return catchAllCause_(self, (e) => O.getOrElse_(pf(e), () => halt<E | E2>(e)))
}

/**
 * Recovers from some or all of the error cases.
 */
export function catchSomeCause<R, E, A, R2, E2, A2>(
  pf: (e: C.Cause<E>) => O.Option<Managed<R2, E2, A2>>
) {
  return (self: Managed<R, E, A>) => catchSomeCause_(self, pf)
}

/**
 * Fail with `e` if the supplied `PartialFunction` does not match, otherwise
 * continue with the returned value.
 */
export function continueOrFailM_<R, E, A, E1, R1, E2, B>(
  self: Managed<R, E, A>,
  e: () => E1,
  pf: (a: A) => O.Option<Managed<R1, E2, B>>
): Managed<R & R1, E | E1 | E2, B> {
  return core.chain_(self, (a) => O.getOrElse_(pf(a), () => core.fail<E1 | E2>(e())))
}

/**
 * Fail with `e` if the supplied `PartialFunction` does not match, otherwise
 * continue with the returned value.
 */
export function continueOrFailM<A, E1, R1, E2, B>(
  e: () => E1,
  pf: (a: A) => O.Option<Managed<R1, E2, B>>
) {
  return <R, E>(self: Managed<R, E, A>) => continueOrFailM_(self, e, pf)
}

/**
 * Fail with `e` if the supplied `PartialFunction` does not match, otherwise
 * succeed with the returned value.
 */
export function continueOrFail_<R, E, A, E1, B>(
  self: Managed<R, E, A>,
  e: () => E1,
  pf: (a: A) => O.Option<B>
): Managed<R, E | E1, B> {
  return continueOrFailM_(self, e, (x) => pipe(x, pf, O.map(succeed)))
}

/**
 * Fail with `e` if the supplied `PartialFunction` does not match, otherwise
 * succeed with the returned value.
 */
export function continueOrFail<A, E1, B>(e: () => E1, pf: (a: A) => O.Option<B>) {
  return <R, E>(self: Managed<R, E, A>) => continueOrFail_(self, e, pf)
}

/**
 * Provides some of the environment required to run this effect,
 * leaving the remainder `R0` and combining it automatically using spread.
 */
export function provide<R>(r: R) {
  return <E, A, R0>(next: Managed<R & R0, E, A>): Managed<R0, E, A> =>
    core.provideSome_(next, (r0: R0) => ({ ...r0, ...r }))
}

/**
 * Executes the second effect and then provides its output as an environment to this effect
 */
export function compose<A, E2, B>(that: Managed<A, E2, B>) {
  return <R, E>(self: Managed<R, E, A>) =>
    gen(function* (_) {
      const r1 = yield* _(environment<R>())
      const r = yield* _(provideAll.provideAll(r1)(self))

      return yield* _(provideAll.provideAll(r)(that))
    })
}

/**
 * Returns an effect whose failure and success have been lifted into an
 * `Either`. The resulting effect cannot fail
 */
export function either<R, E, A>(
  self: Managed<R, E, A>
): Managed<R, never, E.Either<E, A>> {
  return fold_(self, E.left, E.right)
}

/**
 * Returns a Managed that ignores errors raised by the acquire effect and
 * runs it repeatedly until it eventually succeeds.
 */
export function eventually<R, E, A>(self: Managed<R, E, A>): Managed<R, never, A> {
  return new Managed(T.eventually(self.effect))
}

/**
 * Zips this effect with its environment
 */
export function first<R, E, A>(self: Managed<R, E, A>) {
  return core.zip_(self, environment<R>())
}

/**
 * Effectfully map the error channel
 */
export function chainError_<R, E, A, R2, E2>(
  self: Managed<R, E, A>,
  f: (e: E) => RIO<R2, E2>
): Managed<R & R2, E2, A> {
  return flipWith_(self, core.chain(f))
}

/**
 * Effectfully map the error channel
 */
export function chainError<E, R2, E2>(f: (e: E) => RIO<R2, E2>) {
  return <R, A>(self: Managed<R, E, A>) => chainError_(self, f)
}

/**
 * Flip the error and result
 */
export function flip<R, E, A>(self: Managed<R, E, A>): Managed<R, A, E> {
  return foldM_(self, succeed, core.fail)
}

/**
 * Flip the error and result, then apply an effectful function to the effect
 */
export function flipWith_<R, E, A, R2, E1, A1>(
  self: Managed<R, E, A>,
  f: (_: Managed<R, A, E>) => Managed<R2, A1, E1>
) {
  return flip(f(flip(self)))
}

/**
 * Flip the error and result, then apply an effectful function to the effect
 */
export function flipWith<R, E, A, R2, E1, A1>(
  f: (_: Managed<R, A, E>) => Managed<R2, A1, E1>
) {
  return (self: Managed<R, E, A>) => flipWith_(self, f)
}

/**
 * Returns an effect that performs the outer effect first, followed by the
 * inner effect, yielding the value of the inner effect.
 *
 * This method can be used to "flatten" nested effects.
 */
export function flatten<R2, E2, R, E, A>(self: Managed<R2, E2, Managed<R, E, A>>) {
  return core.chain_(self, identity)
}

/**
 * Returns an effect that performs the outer effect first, followed by the
 * inner effect, yielding the value of the inner effect.
 *
 * This method can be used to "flatten" nested effects.
 */
export function flattenM<R2, E2, R, E, A>(self: Managed<R2, E2, T.Effect<R, E, A>>) {
  return core.mapM_(self, identity)
}

/**
 * A more powerful version of `fold` that allows recovering from any kind of failure except interruptions.
 */
export function foldCause_<R, E, A, B, C>(
  self: Managed<R, E, A>,
  f: (e: C.Cause<E>) => B,
  g: (a: A) => C
) {
  return fold_(sandbox(self), f, g)
}

/**
 * A more powerful version of `fold` that allows recovering from any kind of failure except interruptions.
 */
export function foldCause<E, A, B, C>(f: (e: C.Cause<E>) => B, g: (a: A) => C) {
  return <R>(self: Managed<R, E, A>) => fold_(sandbox(self), f, g)
}

/**
 * Returns a new effect that ignores the success or failure of this effect.
 */
export function ignore<R, E, A>(self: Managed<R, E, A>): Managed<R, never, void> {
  return fold_(self, constVoid, constVoid)
}

/**
 * Returns whether this managed effect is a failure.
 */
export function isFailure<R, E, A>(self: Managed<R, E, A>) {
  return fold_(
    self,
    () => true,
    () => false
  )
}

/**
 * Returns whether this managed effect is a success.
 */
export function isSuccess<R, E, A>(self: Managed<R, E, A>) {
  return fold_(
    self,
    () => false,
    () => true
  )
}

/**
 * Depending on the environment execute this or the other effect
 */
export function join<R1, E1, A1>(that: Managed<R1, E1, A1>) {
  return <R, E, A>(self: Managed<R, E, A>): Managed<E.Either<R, R1>, E | E1, A | A1> =>
    join_(self, that)
}

/**
 * Depending on the environment execute this or the other effect
 */
export function join_<R, E, A, R1, E1, A1>(
  self: Managed<R, E, A>,
  that: Managed<R1, E1, A1>
): Managed<E.Either<R, R1>, E | E1, A | A1> {
  return gen(function* (_) {
    const either = yield* _(environment<E.Either<R, R1>>())
    const a1 = yield* _(
      E.fold_(
        either,
        (r): IO<E | E1, A | A1> => provideAll.provideAll(r)(self),
        (r1) => provideAll.provideAll(r1)(that)
      )
    )
    return a1
  })
}

/**
 * Depending on provided environment returns either this one or the other effect.
 */
export function joinEither<R2, E2, A2>(that: Managed<R2, E2, A2>) {
  return <R, E, A>(
    self: Managed<R, E, A>
  ): Managed<E.Either<R, R2>, E | E2, E.Either<A, A2>> => joinEither_(self, that)
}

/**
 * Depending on provided environment returns either this one or the other effect.
 */
export function joinEither_<R, E, A, R2, E2, A2>(
  self: Managed<R, E, A>,
  that: Managed<R2, E2, A2>
): Managed<E.Either<R, R2>, E | E2, E.Either<A, A2>> {
  return gen(function* (_) {
    const e = yield* _(environment<E.Either<R, R2>>())
    const r = yield* _(
      E.fold_(
        e,
        (r0): IO<E | E2, E.Either<A, A2>> =>
          provideAll.provideAll_(core.map_(self, E.left), r0),
        (r1) => provideAll.provideAll_(core.map_(that, E.right), r1)
      )
    )
    return r
  })
}

/**
 * Join self selectively with C
 */
export function identityLeft<C>() {
  return <R, E, A>(
    self: Managed<R, E, A>
  ): Managed<E.Either<R, C>, E, E.Either<A, C>> => joinEither_(self, environment<C>())
}

/**
 * Lifts a synchronous side-effect into a `Managed[R, E, A]`,
 * translating any thrown exceptions into typed failed effects using onThrow.
 */
export function effectPartial<E, A>(
  f: () => A,
  onThrow: (u: unknown) => E
): Managed<unknown, E, A> {
  return fromEffect(T.effectPartial(f, onThrow))
}

/**
 * Returns an effect whose success is mapped by the specified side effecting
 * `f` function, translating any thrown exceptions into typed failed effects.
 */
export function mapEffectWith<E2, A, B>(onThrow: (u: unknown) => E2, f: (a: A) => B) {
  return <R, E>(self: Managed<R, E, A>): Managed<R, E | E2, B> =>
    mapEffectWith_(self, onThrow, f)
}

/**
 * Returns an effect whose success is mapped by the specified side effecting
 * `f` function, translating any thrown exceptions into typed failed effects.
 */
export function mapEffectWith_<R, E, E2, A, B>(
  self: Managed<R, E, A>,
  onThrow: (u: unknown) => E2,
  f: (a: A) => B
): Managed<R, E | E2, B> {
  return foldM_(
    self,
    (e) => core.fail(e),
    (a) => effectPartial(() => f(a), onThrow)
  )
}

/**
 * Returns an effect whose success is mapped by the specified side effecting
 * `f` function, translating any thrown exceptions into typed failed effects.
 */
export function mapEffect_<R, E, A, B>(
  self: Managed<R, E, A>,
  f: (a: A) => B
): Managed<R, unknown, B> {
  return mapEffectWith_(self, identity, f)
}

/**
 * Returns an effect whose success is mapped by the specified side effecting
 * `f` function, translating any thrown exceptions into typed failed effects.
 */
export function mapEffect<A, B>(f: (a: A) => B) {
  return <R, E>(self: Managed<R, E, A>): Managed<R, unknown, B> => mapEffect_(self, f)
}

/**
 * Preallocates the managed resource, resulting in a Managed that reserves
 * and acquires immediately and cannot fail. You should take care that you
 * are not interrupted between running preallocate and actually acquiring
 * the resource as you might leak otherwise.
 */
export function preallocate<R, E, A>(self: Managed<R, E, A>): T.Effect<R, E, UIO<A>> {
  return T.uninterruptibleMask(({ restore }) =>
    T.gen(function* (_) {
      const releaseMap = yield* _(makeReleaseMap.makeReleaseMap)
      const tp = yield* _(
        T.result(restore(T.provideSome_(self.effect, (r: R) => tuple(r, releaseMap))))
      )
      const preallocated = yield* _(
        Ex.foldM_(
          tp,
          (c) =>
            pipe(
              releaseMap,
              releaseAll.releaseAll(Ex.fail(c), T.sequential),
              T.andThen(T.halt(c))
            ),
          ([release, a]) =>
            T.succeed(
              new Managed(
                T.accessM(([_, releaseMap]: readonly [unknown, RM.ReleaseMap]) =>
                  T.map_(add.add(release)(releaseMap), (_) => tuple(_, a))
                )
              )
            )
        )
      )

      return preallocated
    })
  )
}

/**
 * Preallocates the managed resource inside an outer managed, resulting in a
 * Managed that reserves and acquires immediately and cannot fail.
 */
export function preallocateManaged<R, E, A>(
  self: Managed<R, E, A>
): Managed<R, E, UIO<A>> {
  return new Managed(
    T.map_(self.effect, ([release, a]) =>
      tuple(
        release,
        new Managed(
          T.accessM(([_, releaseMap]: readonly [unknown, RM.ReleaseMap]) =>
            T.map_(add.add(release)(releaseMap), (_) => tuple(_, a))
          )
        )
      )
    )
  )
}

/**
 * Provides a layer to the `Managed`, which translates it to another level.
 */
export function provideLayer<R2, E2, R>(layer: L.Layer<R2, E2, R>) {
  return <E, A>(self: Managed<R, E, A>): Managed<R2, E2 | E, A> =>
    provideLayer_(self, layer)
}

/**
 * Provides a layer to the `Managed`, which translates it to another level.
 */
export function provideLayer_<R, E, A, R2, E2>(
  self: Managed<R, E, A>,
  layer: L.Layer<R2, E2, R>
): Managed<R2, E | E2, A> {
  return core.chain_(L.build(layer), (r) => provideAll.provideAll_(self, r))
}

/**
 * Splits the environment into two parts, providing one part using the
 * specified layer and leaving the remainder `R0`.
 */
export function provideSomeLayer<R2, E2, R>(layer: L.Layer<R2, E2, R>) {
  return <R0, E, A>(self: Managed<R & R0, E, A>): Managed<R0 & R2, E | E2, A> =>
    provideLayer(layer["+++"](L.identity<R0>()))(self)
}

/**
 * Keeps some of the errors, and terminates the fiber with the rest, using
 * the specified function to convert the `E` into a `Throwable`.
 */
export function refineOrDieWith<E, E1>(
  pf: (e: E) => O.Option<E1>,
  f: (e: E) => unknown
) {
  return <R, A>(self: Managed<R, E, A>) => refineOrDieWith_(self, pf, f)
}

/**
 * Keeps some of the errors, and terminates the fiber with the rest, using
 * the specified function to convert the `E` into a `Throwable`.
 */
export function refineOrDieWith_<R, A, E, E1>(
  self: Managed<R, E, A>,
  pf: (e: E) => O.Option<E1>,
  f: (e: E) => unknown
) {
  return catchAll_(self, (e) =>
    pipe(
      e,
      pf,
      O.fold(
        () => die(f(e)),
        (e1) => core.fail(e1)
      )
    )
  )
}

/**
 * Keeps some of the errors, and terminates the fiber with the rest
 */
export function refineOrDie<E, E1>(pf: (e: E) => O.Option<E1>) {
  return refineOrDieWith(pf, identity)
}

/**
 * Keeps some of the errors, and terminates the fiber with the rest
 */
export function refineOrDie_<R, A, E, E1>(
  self: Managed<R, E, A>,
  pf: (e: E) => O.Option<E1>
) {
  return refineOrDie(pf)(self)
}

/**
 * Returns a managed that dies with the specified `unknown`. This method
 * can be used for terminating a fiber because a defect has been
 * detected in the code.
 */
export function die(e: unknown) {
  return halt(C.die(e))
}

/**
 * Returns an effect that dies with a [[java.lang.RuntimeException]] having the
 * specified text message. This method can be used for terminating a fiber
 * because a defect has been detected in the code.
 */
export function dieMessage(message: string) {
  return die(new RuntimeError(message))
}

/**
 * Continue with the returned computation if the `PartialFunction` matches,
 * translating the successful match into a failure, otherwise continue with
 * our held value.
 */
export function rejectM<A, R1, E1>(pf: (a: A) => O.Option<Managed<R1, E1, E1>>) {
  return <R, E>(self: Managed<R, E, A>): Managed<R & R1, E | E1, A> =>
    rejectM_(self, pf)
}

/**
 * Continue with the returned computation if the `PartialFunction` matches,
 * translating the successful match into a failure, otherwise continue with
 * our held value.
 */
export function rejectM_<R, E, A, R1, E1>(
  self: Managed<R, E, A>,
  pf: (a: A) => O.Option<Managed<R1, E1, E1>>
) {
  return core.chain_(self, (a) =>
    O.fold_(
      pf(a),
      () => succeed(a),
      (_) => core.chain_(_, (e1) => core.fail(e1))
    )
  )
}

/**
 * Fail with the returned value if the `PartialFunction` matches, otherwise
 * continue with our held value.
 */
export function reject<A, E1>(pf: (a: A) => O.Option<E1>) {
  return <R, E>(self: Managed<R, E, A>) => reject_(self, pf)
}

/**
 * Fail with the returned value if the `PartialFunction` matches, otherwise
 * continue with our held value.
 */
export function reject_<R, E, A, E1>(
  self: Managed<R, E, A>,
  pf: (a: A) => O.Option<E1>
) {
  return rejectM_(self, (x) => pipe(x, pf, O.map(core.fail)))
}

/**
 * Runs all the finalizers associated with this scope. This is useful to
 * conceptually "close" a scope when composing multiple managed effects.
 * Note that this is only safe if the result of this managed effect is valid
 * outside its scope.
 */
export function release<R, E, A>(self: Managed<R, E, A>) {
  return fromEffect(core.useNow(self))
}

/**
 * Returns an effect that retries this effect with the specified schedule when it fails, until
 * the schedule is done, then both the value produced by the schedule together with the last
 * error are passed to the specified recovery function.
 */
export function retryOrElseEither_<R, E, A, R1, O, R2, E2, A2>(
  self: Managed<R, E, A>,
  policy: Schedule<R1, E, O>,
  orElse: (e: E, o: O) => Managed<R2, E2, A2>
): Managed<R & R1 & R2 & HasClock, E2, E.Either<A2, A>> {
  return new Managed(
    T.map_(
      T.accessM(([env, releaseMap]: readonly [R & R1 & R2 & HasClock, RM.ReleaseMap]) =>
        T.provideAll_(
          T.retryOrElseEither_(
            T.provideAll_(self.effect, tuple(env, releaseMap)),
            policy,
            (e, o) => T.provideAll_(orElse(e, o).effect, tuple(env, releaseMap))
          ),
          env
        )
      ),
      E.fold(
        ([f, a]) => tuple<[RM.Finalizer, E.Either<A2, A>]>(f, E.left(a)),
        ([f, a]) => tuple<[RM.Finalizer, E.Either<A2, A>]>(f, E.right(a))
      )
    )
  )
}

/**
 * Returns an effect that retries this effect with the specified schedule when it fails, until
 * the schedule is done, then both the value produced by the schedule together with the last
 * error are passed to the specified recovery function.
 */
export function retryOrElseEither<E, R1, O, R2, E2, A2>(
  policy: Schedule<R1, E, O>,
  orElse: (e: E, o: O) => Managed<R2, E2, A2>
) {
  return <R, A>(self: Managed<R, E, A>) => retryOrElseEither_(self, policy, orElse)
}

/**
 * Retries with the specified schedule, until it fails, and then both the
 * value produced by the schedule together with the last error are passed to
 * the recovery function.
 */
export function retryOrElse_<R, E, A, R1, O, R2, E2, A2>(
  self: Managed<R, E, A>,
  policy: Schedule<R1, E, O>,
  orElse: (e: E, o: O) => Managed<R2, E2, A2>
): Managed<R & R1 & R2 & HasClock, E2, A | A2> {
  return core.map_(retryOrElseEither_(self, policy, orElse), E.fold(identity, identity))
}

/**
 * Retries with the specified schedule, until it fails, and then both the
 * value produced by the schedule together with the last error are passed to
 * the recovery function.
 */
export function retryOrElse<E, R1, O, R2, E2, A2>(
  policy: Schedule<R1, E, O>,
  orElse: (e: E, o: O) => Managed<R2, E2, A2>
) {
  return <R, A>(self: Managed<R, E, A>) => retryOrElse_(self, policy, orElse)
}

/**
 * Retries with the specified retry policy.
 * Retries are done following the failure of the original `io` (up to a fixed maximum with
 * `once` or `recurs` for example), so that that `io.retry(Schedule.once)` means
 * "execute `io` and in case of failure, try again once".
 */
export function retry_<R, E, A, R1, O>(
  self: Managed<R, E, A>,
  policy: Schedule<R1, E, O>
): Managed<R & R1 & HasClock, E, A> {
  return retryOrElse_(self, policy, (e, _) => core.fail(e))
}

/**
 * Retries with the specified retry policy.
 * Retries are done following the failure of the original `io` (up to a fixed maximum with
 * `once` or `recurs` for example), so that that `io.retry(Schedule.once)` means
 * "execute `io` and in case of failure, try again once".
 */
export function retry<R1, E, O>(policy: Schedule<R1, E, O>) {
  return <R, A>(self: Managed<R, E, A>): Managed<R & R1 & HasClock, E, A> =>
    retry_(self, policy)
}

/**
 * Returns an effect that semantically runs the effect on a fiber,
 * producing an `Exit` for the completion value of the fiber.
 */
export function result<R, E, A>(
  self: Managed<R, E, A>
): Managed<R, never, Ex.Exit<E, A>> {
  return core.foldCauseM_(
    self,
    (x) => pipe(x, Ex.halt, succeed),
    (x) => pipe(x, Ex.succeed, succeed)
  )
}

/**
 * Exposes the full cause of failure of this effect.
 */
export function sandbox<R, E, A>(self: Managed<R, E, A>) {
  return new Managed(T.sandbox(self.effect))
}

/**
 * The inverse operation to `sandbox`. Submerges the full cause of failure.
 */
export function unsandbox<R, E, A>(self: Managed<R, C.Cause<E>, A>) {
  return mapErrorCause_(self, C.flatten)
}

/**
 * Companion helper to `sandbox`. Allows recovery, and partial recovery, from
 * errors and defects alike.
 */
export function sandboxWith<R, E, A, R2, E2, B>(
  f: (_: Managed<R, C.Cause<E>, A>) => Managed<R2, C.Cause<E2>, B>
) {
  return (self: Managed<R, E, A>) => sandboxWith_(self, f)
}

/**
 * Companion helper to `sandbox`. Allows recovery, and partial recovery, from
 * errors and defects alike.
 */
export function sandboxWith_<R, E, A, R2, E2, B>(
  self: Managed<R, E, A>,
  f: (_: Managed<R, C.Cause<E>, A>) => Managed<R2, C.Cause<E2>, B>
) {
  return unsandbox(f(sandbox(self)))
}

/**
 * Zips this effect with its environment
 */
export function second<R, E, A>(self: Managed<R, E, A>) {
  return core.zip_(environment<R>(), self)
}

/**
 * Converts an option on values into an option on errors.
 */
export function some<R, E, A>(
  self: Managed<R, E, O.Option<A>>
): Managed<R, O.Option<E>, A> {
  return foldM_(
    self,
    (x) => pipe(x, O.some, core.fail),
    O.fold(() => core.fail(O.none), succeed)
  )
}

/**
 * Extracts the optional value, or returns the given 'orElse'.
 */
export function someOrElse<B>(orElse: () => B) {
  return <R, E, A>(self: Managed<R, E, O.Option<A>>): Managed<R, E, A | B> =>
    someOrElse_(self, orElse)
}

/**
 * Extracts the optional value, or returns the given 'orElse'.
 */
export function someOrElse_<R, E, A, B>(
  self: Managed<R, E, O.Option<A>>,
  orElse: () => B
) {
  return core.map_(self, O.getOrElse(orElse))
}

/**
 * Extracts the optional value, or executes the effect 'orElse'.
 */
export function someOrElseM<R1, E1, B>(orElse: Managed<R1, E1, B>) {
  return <R, E, A>(self: Managed<R, E, O.Option<A>>) => someOrElseM_(self, orElse)
}

/**
 * Extracts the optional value, or executes the effect 'orElse'.
 */
export function someOrElseM_<R, E, A, R1, E1, B>(
  self: Managed<R, E, O.Option<A>>,
  orElse: Managed<R1, E1, B>
) {
  return core.chain_(
    self,
    O.fold((): Managed<R1, E1, A | B> => orElse, succeed)
  )
}

/**
 * Extracts the optional value, or fails with the given error 'e'.
 */
export function someOrFail<E1>(e: () => E1) {
  return <R, E, A>(self: Managed<R, E, O.Option<A>>): Managed<R, E1 | E, A> =>
    someOrFail_(self, e)
}

/**
 * Extracts the optional value, or fails with the given error 'e'.
 */
export function someOrFail_<R, E, A, E1>(
  self: Managed<R, E, O.Option<A>>,
  e: () => E1
) {
  return core.chain_(
    self,
    O.fold(() => core.fail(e()), succeed)
  )
}

/**
 * Extracts the optional value, or fails with a `NoSuchElementException`
 */
export function someOrFailException<R, E, A>(
  self: Managed<R, E, O.Option<A>>
): Managed<R, E | NoSuchElementException, A> {
  return someOrFail_(self, () => new NoSuchElementException())
}

/**
 * Returns an effect that effectfully peeks at the failure or success of the acquired resource.
 */
export function tapBoth_<R, E, A, R1, E1, R2, E2, X, Y>(
  self: Managed<R, E, A>,
  f: (e: E) => Managed<R1, E1, X>,
  g: (a: A) => Managed<R2, E2, Y>
): Managed<R & R1 & R2, E | E1 | E2, A> {
  return foldM_(
    self,
    (e) => core.chain_(f(e), () => core.fail(e)),
    (a) => core.map_(g(a), () => a)
  )
}

/**
 * Returns an effect that effectfully peeks at the failure or success of the acquired resource.
 */
export function tapBoth<E, A, R1, E1, R2, E2, X, Y>(
  f: (e: E) => Managed<R1, E1, X>,
  g: (a: A) => Managed<R2, E2, Y>
) {
  return <R>(self: Managed<R, E, A>) => tapBoth_(self, f, g)
}

/**
 * Returns an effect that effectually peeks at the cause of the failure of
 * the acquired resource.
 */
export function tapCause_<R, E, A, R1, E1, X>(
  self: Managed<R, E, A>,
  f: (c: Cause<E>) => Managed<R1, E1, X>
): Managed<R & R1, E | E1, A> {
  return catchAllCause_(self, (c) => core.chain_(f(c), () => halt(c)))
}

/**
 * Returns an effect that effectually peeks at the cause of the failure of
 * the acquired resource.
 */
export function tapCause<E, R1, E1, X>(f: (c: Cause<E>) => Managed<R1, E1, X>) {
  return <R, A>(self: Managed<R, E, A>): Managed<R & R1, E | E1, A> =>
    tapCause_(self, f)
}

/**
 * Returns an effect that effectfully peeks at the failure of the acquired resource.
 */
export function tapError_<R, E, A, R1, E1, X>(
  self: Managed<R, E, A>,
  f: (e: E) => Managed<R1, E1, X>
): Managed<R & R1, E | E1, A> {
  return tapBoth_(self, f, succeed)
}

/**
 * Returns an effect that effectfully peeks at the failure of the acquired resource.
 */
export function tapError<E, R1, E1, X>(f: (e: E) => Managed<R1, E1, X>) {
  return <R, A>(self: Managed<R, E, A>) => tapError_(self, f)
}

/**
 * Like `tap`, but uses a function that returns a Effect value rather than a
 * Managed value.
 */
export function tapM<A, R1, E1, X>(f: (a: A) => Effect<R1, E1, X>) {
  return <R, E>(self: Managed<R, E, A>): Managed<R & R1, E | E1, A> => tapM_(self, f)
}

/**
 * Like `tap`, but uses a function that returns a Effect value rather than a
 * Managed value.
 */
export function tapM_<R, E, A, R1, E1, X>(
  self: Managed<R, E, A>,
  f: (a: A) => Effect<R1, E1, X>
) {
  return core.mapM_(self, (a) => T.as_(f(a), a))
}

/**
 * Returns a new effect that executes this one and times the acquisition of the resource.
 */
export function timed<R, E, A>(
  self: Managed<R, E, A>
): Managed<R & HasClock, E, readonly [number, A]> {
  return new Managed(
    T.chain_(T.environment<readonly [R, RM.ReleaseMap]>(), ([r, releaseMap]) =>
      T.provideSome_(
        T.map_(
          T.timed(T.provideAll_(self.effect, [r, releaseMap])),
          ([duration, [fin, a]]) => tuple(fin, tuple(duration, a))
        ),
        (r: readonly [R & HasClock, RM.ReleaseMap]) => r[0]
      )
    )
  )
}

/**
 * Returns an effect that will timeout this resource, returning `None` if the
 * timeout elapses before the resource was reserved and acquired.
 * If the reservation completes successfully (even after the timeout) the release action will be run on a new fiber.
 * `Some` will be returned if acquisition and reservation complete in time
 */
export function timeout_<R, E, A>(self: Managed<R, E, A>, d: number) {
  return new Managed(
    T.uninterruptibleMask(({ restore }) =>
      T.gen(function* (_) {
        const env = yield* _(T.environment<readonly [R & HasClock, RM.ReleaseMap]>())
        const [r, outerReleaseMap] = env
        const innerReleaseMap = yield* _(makeReleaseMap.makeReleaseMap)
        const earlyRelease = yield* _(
          add.add((exit) => releaseAll.releaseAll(exit, T.sequential)(innerReleaseMap))(
            outerReleaseMap
          )
        )
        const raceResult: E.Either<
          F.Fiber<E, readonly [RM.Finalizer, A]>,
          A
        > = yield* _(
          restore(
            T.provideAll_(
              T.raceWith_(
                T.provideAll_(self.effect, tuple(r, innerReleaseMap)),
                T.as_(T.sleep(d), O.none),
                (result, sleeper) =>
                  T.andThen_(
                    F.interrupt(sleeper),
                    T.done(Ex.map_(result, (tp) => E.right(tp[1])))
                  ),
                (_, resultFiber) => T.succeed(E.left(resultFiber))
              ),
              r
            )
          )
        )
        const a = yield* _(
          E.fold_(
            raceResult,
            (f) =>
              T.as_(
                T.chain_(T.fiberId, (id) =>
                  T.forkDaemon(
                    T.ensuring_(
                      F.interrupt(f),
                      releaseAll.releaseAll(
                        Ex.interrupt(id),
                        T.sequential
                      )(innerReleaseMap)
                    )
                  )
                ),
                O.none
              ),
            (v) => T.succeed(O.some(v))
          )
        )

        return tuple(earlyRelease, a)
      })
    )
  )
}

/**
 * Returns an effect that will timeout this resource, returning `None` if the
 * timeout elapses before the resource was reserved and acquired.
 * If the reservation completes successfully (even after the timeout) the release action will be run on a new fiber.
 * `Some` will be returned if acquisition and reservation complete in time
 */
export function timeout(d: number) {
  return <R, E, A>(self: Managed<R, E, A>): Managed<R & HasClock, E, O.Option<A>> =>
    timeout_(self, d)
}

/**
 * Constructs a layer from this managed resource.
 */
export function toLayer<A>(
  tag: Tag<A>
): <R, E>(self: Managed<R, E, A>) => L.Layer<R, E, Has<A>> {
  return L.fromManaged(tag)
}

/**
 * Constructs a layer from this managed resource.
 */
export function toLayer_<R, E, A>(
  self: Managed<R, E, A>,
  tag: Tag<A>
): L.Layer<R, E, Has<A>> {
  return toLayer(tag)(self)
}

/**
 * Constructs a layer from this managed resource, which must return one or
 * more services.
 */
export function toLayerMany<Tags extends Tag<any>[]>(...tags: Tags) {
  return <R, E>(
    self: Managed<
      R,
      E,
      UnionToIntersection<
        {
          [k in keyof Tags & number]: [Tags[k]] extends [Tag<infer A>] ? Has<A> : never
        }[number]
      >
    >
  ) =>
    L.fromRawManaged(
      core.map_(
        self,
        (
          r
        ): UnionToIntersection<
          {
            [k in keyof Tags & number]: [Tags[k]] extends [Tag<infer A>]
              ? Has<A>
              : never
          }[number]
        > => {
          const env: any = {}
          for (const tag of tags) {
            env[tag.key] = tag.read(r as any)
          }
          return env
        }
      )
    )
}

/**
 * Return unit while running the effect
 */
export function asUnit<R, E, A>(self: Managed<R, E, A>): Managed<R, E, void> {
  return as_(self, undefined)
}

/**
 * The moral equivalent of `if (!p) exp` when `p` has side-effects
 */
export function unlessM<R1, E1>(b: Managed<R1, E1, boolean>) {
  return <R, E, A>(self: Managed<R, E, A>): Managed<R1 & R, E1 | E, void> =>
    unlessM_(self, b)
}

/**
 * The moral equivalent of `if (!p) exp` when `p` has side-effects
 */
export function unlessM_<R, E, A, R1, E1>(
  self: Managed<R, E, A>,
  b: Managed<R1, E1, boolean>
): Managed<R1 & R, E1 | E, void> {
  return core.chain_(b, (b) => (b ? unit : asUnit(self)))
}

/**
 * The moral equivalent of `if (!p) exp`
 */
export function unless(b: () => boolean) {
  return unlessM(core.effectTotal(b))
}

/**
 * The moral equivalent of `if (!p) exp`
 */
export function unless_<R, E, A>(self: Managed<R, E, A>, b: () => boolean) {
  return unless(b)(self)
}

/**
 * Maps this effect to the specified constant while preserving the
 * effects of this effect.
 */
export function as_<R, E, A, B>(self: Managed<R, E, A>, b: B) {
  return core.map_(self, () => b)
}

/**
 * Maps this effect to the specified constant while preserving the
 * effects of this effect.
 */
export function as<B>(b: B) {
  return <R, E, A>(self: Managed<R, E, A>) => as_(self, b)
}

/**
 * Maps the success value of this effect to an optional value.
 */
export function asSome<R, E, A>(self: Managed<R, E, A>) {
  return core.map_(self, O.some)
}

/**
 * Maps the error value of this effect to an optional value.
 */
export function asSomeError<R, E, A>(self: Managed<R, E, A>) {
  return mapError_(self, O.some)
}

/**
 * Maps the success value of this effect to a service.
 */
export function asService<A>(tag: Tag<A>) {
  return <R, E>(self: Managed<R, E, A>) => asService_(self, tag)
}

/**
 * Maps the success value of this effect to a service.
 */
export function asService_<R, E, A>(self: Managed<R, E, A>, tag: Tag<A>) {
  return core.map_(self, tag.of)
}

/**
 * Executes the this effect and then provides its output as an environment to the second effect
 */
export function andThen_<R, E, A, R1, E1, B>(
  self: Managed<R, E, A>,
  that: Managed<R1, E1, B>
) {
  return core.chain_(self, () => that)
}

/**
 * Executes the this effect and then provides its output as an environment to the second effect
 */
export function andThen<R1, E1, B>(that: Managed<R1, E1, B>) {
  return <R, E, A>(self: Managed<R, E, A>) => core.chain_(self, () => that)
}

/**
 * Returns an effect whose failure and success channels have been mapped by
 * the specified pair of functions, `f` and `g`.
 */
export function bimap<E, A, E1, A1>(f: (e: E) => E1, g: (a: A) => A1) {
  return <R>(self: Managed<R, E, A>) => bimap_(self, f, g)
}

/**
 * Returns an effect whose failure and success channels have been mapped by
 * the specified pair of functions, `f` and `g`.
 */
export function bimap_<R, E, A, E1, A1>(
  self: Managed<R, E, A>,
  f: (e: E) => E1,
  g: (a: A) => A1
) {
  return core.map_(mapError_(self, f), g)
}

/**
 * Joins with environment passing self selectively on the right side
 */
export function right<C>() {
  return <R, E, A>(self: Managed<R, E, A>) => joinEither_(environment<C>(), self)
}

/**
 * Joins with environment passing self selectively on the left side
 */
export function left<C>() {
  return <R, E, A>(self: Managed<R, E, A>) => joinEither_(self, environment<C>())
}

/**
 * Effectfully accesses the environment of the effect.
 */
export function access<R0, A>(f: (_: R0) => A): RIO<R0, A> {
  return fromEffect(T.access(f))
}

/**
 * Effectfully accesses the environment of the effect.
 */
export function accessManaged<R0, R, E, A>(
  f: (_: R0) => Managed<R, E, A>
): Managed<R & R0, E, A> {
  return core.chain_(environment<R0>(), f)
}

/**
 * Effectfully accesses the environment of the effect.
 */
export function accessM<R0, R, E, A>(
  f: (_: R0) => Effect<R, E, A>
): Managed<R & R0, E, A> {
  return core.mapM_(environment<R0>(), f)
}

/**
 * Access a record of services with the required Service Entries
 */
export function accessServicesM<SS extends Record<string, Tag<any>>>(s: SS) {
  return <R = unknown, E = never, B = unknown>(
    f: (
      a: {
        [k in keyof SS]: [SS[k]] extends [Tag<infer T>] ? T : unknown
      }
    ) => Managed<R, E, B>
  ) =>
    accessManaged(
      (
        r: UnionToIntersection<
          {
            [k in keyof SS]: [SS[k]] extends [Tag<infer T>] ? Has<T> : unknown
          }[keyof SS]
        >
      ) => f(R.map_(s, (v) => r[v.key]) as any)
    )
}

/**
 * Access a tuple of services with the required Service Entries monadically
 */
export const accessServicesTM = <SS extends Tag<any>[]>(...s: SS) => <
  R = unknown,
  E = never,
  B = unknown
>(
  f: (
    ...a: {
      [k in keyof SS]: [SS[k]] extends [Tag<infer T>] ? T : unknown
    }
  ) => Managed<R, E, B>
) =>
  accessManaged(
    (
      r: UnionToIntersection<
        {
          [k in keyof SS]: [SS[k]] extends [Tag<infer T>] ? Has<T> : never
        }[keyof SS & number]
      >
    ) => f(...(A.map_(s, (v) => r[v.key]) as any))
  )

/**
 * Access a tuple of services with the required Service Entries
 */
export function accessServicesT<SS extends Tag<any>[]>(...s: SS) {
  return <B = unknown>(
    f: (
      ...a: {
        [k in keyof SS]: [SS[k]] extends [Tag<infer T>] ? T : unknown
      }
    ) => B
  ) =>
    access(
      (
        r: UnionToIntersection<
          {
            [k in keyof SS]: [SS[k]] extends [Tag<infer T>] ? Has<T> : never
          }[keyof SS & number]
        >
      ) => f(...(A.map_(s, (v) => r[v.key]) as any))
    )
}

/**
 * Access a record of services with the required Service Entries
 */
export function accessServices<SS extends Record<string, Tag<any>>>(s: SS) {
  return <B>(
    f: (
      a: {
        [k in keyof SS]: [SS[k]] extends [Tag<infer T>] ? T : unknown
      }
    ) => B
  ) =>
    access(
      (
        r: UnionToIntersection<
          {
            [k in keyof SS]: [SS[k]] extends [Tag<infer T>] ? Has<T> : unknown
          }[keyof SS]
        >
      ) => f(R.map_(s, (v) => r[v.key]) as any)
    )
}

/**
 * Access a service with the required Service Entry
 */
export function accessServiceM<T>(s: Tag<T>) {
  return <R, E, B>(f: (a: T) => Managed<R, E, B>) =>
    accessManaged((r: Has<T>) => f(r[s.key as any]))
}

/**
 * Access a service with the required Service Entry
 */
export function accessService<T>(s: Tag<T>) {
  return <B>(f: (a: T) => B) => accessServiceM(s)((a) => succeed(f(a)))
}

/**
 * Accesses the specified service in the environment of the effect.
 */
export function service<T>(s: Tag<T>) {
  return accessServiceM(s)((a) => succeed(a))
}

/**
 * Accesses the specified services in the environment of the effect.
 */
export function services<Ts extends readonly Tag<any>[]>(...s: Ts) {
  return access(
    (
      r: UnionToIntersection<
        { [k in keyof Ts]: [Ts[k]] extends [Tag<infer T>] ? Has<T> : never }[number]
      >
    ): Readonly<{ [k in keyof Ts]: [Ts[k]] extends [Tag<infer T>] ? T : never }> =>
      s.map((tag) => tag.read(r as any)) as any
  )
}

/**
 * Provides the service with the required Service Entry
 */
export function provideServiceM<T>(_: Tag<T>) {
  return <R, E>(f: Managed<R, E, T>) => <R1, E1, A1>(
    ma: Managed<R1 & Has<T>, E1, A1>
  ): Managed<R & R1, E | E1, A1> =>
    accessManaged((r: R & R1) =>
      core.chain_(f, (t) => provideAll.provideAll_(ma, mergeEnvironments(_, r, t)))
    )
}

/**
 * Provides the service with the required Service Entry
 */
export function provideService<T>(_: Tag<T>) {
  return (f: T) => <R1, E1, A1>(
    ma: Managed<R1 & Has<T>, E1, A1>
  ): Managed<R1, E1, A1> => provideServiceM(_)(succeed(f))(ma)
}

/**
 * Replaces the service with the required Service Entry
 */
export function replaceServiceM<R, E, T>(_: Tag<T>, f: (_: T) => Managed<R, E, T>) {
  return <R1, E1, A1>(
    ma: Managed<R1 & Has<T>, E1, A1>
  ): Managed<R & R1 & Has<T>, E | E1, A1> =>
    accessServiceM(_)((t) => provideServiceM(_)(f(t))(ma))
}

/**
 * Replaces the service with the required Service Entry
 */
export function replaceServiceM_<R, E, T, R1, E1, A1>(
  ma: Managed<R1 & Has<T>, E1, A1>,
  _: Tag<T>,
  f: (_: T) => Managed<R, E, T>
): Managed<R & R1 & Has<T>, E | E1, A1> {
  return accessServiceM(_)((t) => provideServiceM(_)(f(t))(ma))
}

/**
 * Replaces the service with the required Service Entry
 */
export function replaceService<T>(_: Tag<T>, f: (_: T) => T) {
  return <R1, E1, A1>(ma: Managed<R1 & Has<T>, E1, A1>): Managed<R1 & Has<T>, E1, A1> =>
    accessServiceM(_)((t) => provideServiceM(_)(succeed(f(t)))(ma))
}

/**
 * Replaces the service with the required Service Entry
 */
export function replaceService_<R1, E1, A1, T>(
  ma: Managed<R1 & Has<T>, E1, A1>,
  _: Tag<T>,
  f: (_: T) => T
): Managed<R1 & Has<T>, E1, A1> {
  return accessServiceM(_)((t) => provideServiceM(_)(succeed(f(t)))(ma))
}

/**
 * The moral equivalent of `if (p) exp` when `p` has side-effects
 */
export function whenM<R1, E1>(b: Managed<R1, E1, boolean>) {
  return unlessM(core.map_(b, (b) => !b))
}

/**
 * The moral equivalent of `if (p) exp`
 */
export function when(b: () => boolean) {
  return unless(() => !b())
}

/**
 * A more powerful version of `withEarlyRelease` that allows specifying an
 * exit value in the event of early release.
 */
export function withEarlyReleaseExit_<R, E, A>(
  self: Managed<R, E, A>,
  exit: Ex.Exit<E, A>
): Managed<R, E, readonly [T.UIO<any>, A]> {
  return new Managed(
    T.map_(self.effect, (tp) =>
      tuple(tp[0], tuple(T.uninterruptible(tp[0](exit)), tp[1]))
    )
  )
}

/**
 * A more powerful version of `withEarlyRelease` that allows specifying an
 * exit value in the event of early release.
 */
export function withEarlyReleaseExit<E, A>(exit: Ex.Exit<E, A>) {
  return <R>(self: Managed<R, E, A>) => withEarlyReleaseExit_(self, exit)
}

/**
 * Returns an effect that succeeds with the `Fiber.Id` of the caller.
 */
export const fiberId = fromEffect(T.fiberId)

/**
 * Modifies this `Managed` to provide a canceler that can be used to eagerly
 * execute the finalizer of this `Managed`. The canceler will run
 * uninterruptibly with an exit value indicating that the effect was
 * interrupted, and if completed will cause the regular finalizer to not run.
 */
export function withEarlyRelease<R, E, A>(
  self: Managed<R, E, A>
): Managed<R, E, readonly [T.UIO<any>, A]> {
  return core.chain_(fiberId, (id) => withEarlyReleaseExit_(self, Ex.interrupt(id)))
}

/**
 * Sequentially zips this effect with the specified effect
 * returning the left side
 */
export function zipLeft_<R, E, A, R2, E2, A2>(
  a: Managed<R, E, A>,
  b: Managed<R2, E2, A2>
): Managed<R & R2, E | E2, A> {
  return core.zipWith_(a, b, (a) => a)
}

/**
 * Sequentially zips this effect with the specified effect
 * returning the left side
 */
export function zipLeft<R2, E2, A2>(b: Managed<R2, E2, A2>) {
  return <R, E, A>(a: Managed<R, E, A>) => zipLeft_(a, b)
}

/**
 * Parallelly zips this effect with the specified effect
 * returning the left side
 */
export function zipLeftPar_<R, E, A, R2, E2, A2>(
  a: Managed<R, E, A>,
  b: Managed<R2, E2, A2>
): Managed<R & R2, E | E2, A> {
  return core.zipWithPar_(a, b, (a) => a)
}

/**
 * Parallelly zips this effect with the specified effect
 * returning the left side
 */
export function zipLeftPar<R2, E2, A2>(b: Managed<R2, E2, A2>) {
  return <R, E, A>(a: Managed<R, E, A>) => zipLeftPar_(a, b)
}

/**
 * Sequentially zips this effect with the specified effect
 * returning the right side
 */
export function zipRight_<R, E, A, R2, E2, A2>(
  a: Managed<R, E, A>,
  b: Managed<R2, E2, A2>
): Managed<R & R2, E | E2, A2> {
  return core.zipWith_(a, b, (_, a) => a)
}

/**
 * Sequentially zips this effect with the specified effect
 * returning the right side
 */
export function zipRight<R2, E2, A2>(b: Managed<R2, E2, A2>) {
  return <R, E, A>(a: Managed<R, E, A>) => zipRight_(a, b)
}

/**
 * Parallelly zips this effect with the specified effect
 * returning the right side
 */
export function zipRightPar_<R, E, A, R2, E2, A2>(
  a: Managed<R, E, A>,
  b: Managed<R2, E2, A2>
): Managed<R & R2, E | E2, A2> {
  return core.zipWithPar_(a, b, (_, a) => a)
}

/**
 * Parallelly zips this effect with the specified effect
 * returning the right side
 */
export function zipRightPar<R2, E2, A2>(b: Managed<R2, E2, A2>) {
  return <R, E, A>(a: Managed<R, E, A>) => zipRightPar_(a, b)
}

/**
 * Parallely zips this effects
 */
export function zipPar_<R, E, A, R2, E2, A2>(
  a: Managed<R, E, A>,
  b: Managed<R2, E2, A2>
): Managed<R & R2, E | E2, [A, A2]> {
  return core.zipWithPar_(a, b, (a, b) => [a, b])
}

/**
 * Parallely zips this effects
 */
export function zipPar<R2, E2, A2>(b: Managed<R2, E2, A2>) {
  return <R, E, A>(a: Managed<R, E, A>): Managed<R & R2, E | E2, [A, A2]> =>
    zipPar_(a, b)
}

/**
 * Creates new `Managed` from a `Effect` value that uses a `ReleaseMap` and returns
 * a resource and a finalizer.
 *
 * The correct usage of this constructor consists of:
 * - Properly registering a finalizer in the ReleaseMap as part of the `Effect` value;
 * - Managing interruption safety - take care to use `uninterruptible` or
 *   `uninterruptibleMask` to verify that the finalizer is registered in the
 *   `ReleaseMap` after acquiring the value;
 * - Returning the finalizer returned from `ReleaseMap#add`. This is important
 *   to prevent double-finalization.
 */
export function create<R, E, A>(
  effect: T.Effect<readonly [R, RM.ReleaseMap], E, readonly [RM.Finalizer, A]>
) {
  return new Managed(effect)
}

/**
 * Evaluate the predicate,
 * return the given A as success if predicate returns true, and the given E as error otherwise
 */
export function cond_<E, A>(pred: boolean, result: () => A, error: () => E): IO<E, A> {
  return pred ? succeed(result()) : core.fail(error())
}

/**
 * Applies the function `f` to each element of the `Iterable[A]` and runs
 * produced effects in parallel, discarding the results.
 *
 * For a sequential version of this method, see `forEachUnit_`.
 */
export function forEachUnitPar_<R, E, A, B>(
  as: Iterable<A>,
  f: (a: A) => Managed<R, E, B>,
  __trace?: string
): Managed<R, E, void> {
  return core.mapM_(core.makeManagedReleaseMap(T.parallel), (parallelReleaseMap) => {
    const makeInnerMap = T.provideSome_(
      T.map_(core.makeManagedReleaseMap(T.sequential).effect, ([_, e]) => e),
      (r) => tuple(r, parallelReleaseMap)
    )
    return T.forEachUnitPar_(as, (a) =>
      T.chain_(makeInnerMap, (innerMap) =>
        T.provideSome_(
          T.map_(f(a).effect, ([_, a]) => a),
          (r: R) => tuple(r, innerMap)
        )
      )
    )
  })
}

/**
 * Applies the function `f` to each element of the `Iterable[A]` and runs
 * produced effects in parallel, discarding the results.
 *
 * For a sequential version of this method, see `forEachUnit_`.
 */
export function forEachUnitPar<R, E, A, B>(
  f: (a: A) => Managed<R, E, B>,
  __trace?: string
) {
  return (as: Iterable<A>) => forEachUnitPar_(as, f, __trace)
}

/**
 * Applies the function `f` to each element of the `Iterable[A]` and runs
 * produced effects in parallel, discarding the results.
 *
 * For a sequential version of this method, see `forEachUnit_`.
 */
export function forEachUnitParN_<R, E, A, B>(
  as: Iterable<A>,
  n: number,
  f: (a: A) => Managed<R, E, B>,
  __trace?: string
): Managed<R, E, void> {
  return core.mapM_(core.makeManagedReleaseMap(T.parallel), (parallelReleaseMap) => {
    const makeInnerMap = T.provideSome_(
      T.map_(core.makeManagedReleaseMap(T.sequential).effect, ([_, e]) => e),
      (r) => tuple(r, parallelReleaseMap)
    )

    return T.forEachUnitParN_(as, n, (a) =>
      T.chain_(makeInnerMap, (innerMap) =>
        T.provideSome_(
          T.map_(f(a).effect, ([_, a]) => a),
          (r: R) => tuple(r, innerMap)
        )
      )
    )
  })
}

/**
 * Applies the function `f` to each element of the `Iterable[A]` and runs
 * produced effects in parallel, discarding the results.
 *
 * For a sequential version of this method, see `forEachUnit_`.
 *
 * @dataFirst forEachUnitParN
 */
export function forEachUnitParN<R, E, A, B>(n: number, f: (a: A) => Managed<R, E, B>) {
  return (as: Iterable<A>): Managed<R, E, void> => forEachUnitParN_(as, n, f)
}

/**
 * Evaluate each effect in the structure from left to right, collecting the
 * the successful values and discarding the empty cases. For a parallel version, see `collectPar`.
 *
 * @dataFirst collect_
 */
export function collect<A, R, E, B>(f: (a: A) => Managed<R, Option<E>, B>) {
  return (self: Iterable<A>): Managed<R, E, readonly B[]> => collect_(self, f)
}

/**
 * Evaluate each effect in the structure from left to right, collecting the
 * the successful values and discarding the empty cases. For a parallel version, see `collectPar`.
 */
export function collect_<A, R, E, B>(
  self: Iterable<A>,
  f: (a: A) => Managed<R, Option<E>, B>
): Managed<R, E, readonly B[]> {
  return core.map_(
    forEach.forEach_(self, (a) => optional(f(a))),
    A.compact
  )
}

/**
 * Evaluate each effect in the structure in parallel, collecting the
 * the successful values and discarding the empty cases.
 *
 * @dataFirst collectPar_
 */
export function collectPar<A, R, E, B>(f: (a: A) => Managed<R, Option<E>, B>) {
  return (self: Iterable<A>): Managed<R, E, readonly B[]> => collectPar_(self, f)
}

/**
 * Evaluate each effect in the structure in parallel, collecting the
 * the successful values and discarding the empty cases.
 */
export function collectPar_<A, R, E, B>(
  self: Iterable<A>,
  f: (a: A) => Managed<R, Option<E>, B>
): Managed<R, E, readonly B[]> {
  return core.map_(
    forEach.forEachPar_(self, (a) => optional(f(a))),
    A.compact
  )
}

/**
 * Evaluate each effect in the structure in parallel, collecting the
 * the successful values and discarding the empty cases.
 *
 * Unlike `collectPar`, this method will use at most up to `n` fibers.
 */
export function collectParN_<A, R, E, B>(
  self: Iterable<A>,
  n: number,
  f: (a: A) => Managed<R, Option<E>, B>
): Managed<R, E, readonly B[]> {
  return core.map_(
    forEach.forEachParN_(self, n, (a) => optional(f(a))),
    A.compact
  )
}

/**
 * Evaluate each effect in the structure in parallel, collecting the
 * the successful values and discarding the empty cases.
 *
 * Unlike `collectPar`, this method will use at most up to `n` fibers.
 *
 * @dataFirst collectParN_
 */
export function collectParN<A, R, E, B>(
  n: number,
  f: (a: A) => Managed<R, Option<E>, B>
): (self: Iterable<A>) => Managed<R, E, readonly B[]> {
  return (self) => collectParN_(self, n, f)
}

/**
 * Evaluate each effect in the structure from left to right, and collect the
 * results. For a parallel version, see `collectAllPar`.
 */
export function collectAll<R, E, A>(as: Iterable<Managed<R, E, A>>) {
  return forEach.forEach_(as, identity)
}

/**
 * Evaluate each effect in the structure in parallel, and collect the
 * results. For a sequential version, see `collectAll`.
 */
export function collectAllPar<R, E, A>(as: Iterable<Managed<R, E, A>>) {
  return forEach.forEachPar_(as, identity)
}

/**
 * Evaluate each effect in the structure in parallel, and collect the
 * results. For a sequential version, see `collectAll`.
 *
 * Unlike `collectAllPar`, this method will use at most `n` fibers.
 *
 * @dataFirst collectAllParN_
 */
export function collectAllParN(n: number) {
  return <R, E, A>(as: Iterable<Managed<R, E, A>>) =>
    forEach.forEachParN_(as, n, identity)
}

/**
 * Evaluate each effect in the structure in parallel, and collect the
 * results. For a sequential version, see `collectAll`.
 *
 * Unlike `collectAllPar`, this method will use at most `n` fibers.
 */
export function collectAllParN_<R, E, A>(as: Iterable<Managed<R, E, A>>, n: number) {
  return forEach.forEachParN_(as, n, identity)
}

/**
 * Evaluate each effect in the structure from left to right, and discard the
 * results. For a parallel version, see `collectAllUnitPar`.
 */
export function collectAllUnit<R, E, A>(as: Iterable<Managed<R, E, A>>) {
  return forEach.forEachUnit_(as, identity)
}

/**
 * Evaluate each effect in the structure in parallel, and discard the
 * results. For a sequential version, see `collectAllUnit`.
 */
export function collectAllUnitPar<R, E, A>(
  as: Iterable<Managed<R, E, A>>,
  __trace?: string
) {
  return forEachUnitPar_(as, identity, __trace)
}

/**
 * Evaluate each effect in the structure in parallel, and discard the
 * results. For a sequential version, see `collectAllUnit`.
 *
 * Unlike `collectAllUnitPar`, this method will use at most `n` fibers.
 *
 * @dataFirst collectAllUnitParN_
 */
export function collectAllUnitParN(n: number, __trace?: string) {
  return <R, E, A>(as: Iterable<Managed<R, E, A>>) =>
    forEachUnitParN_(as, n, identity, __trace)
}

/**
 * Evaluate each effect in the structure in parallel, and discard the
 * results. For a sequential version, see `collectAllUnit`.
 *
 * Unlike `collectAllUnitPar`, this method will use at most `n` fibers.
 */
export function collectAllUnitParN_<R, E, A>(
  as: Iterable<Managed<R, E, A>>,
  n: number,
  __trace?: string
) {
  return forEachUnitParN_(as, n, identity, __trace)
}

/**
 * Evaluate each effect in the structure with `collectAll`, and collect
 * the results with given partial function.
 */
export function collectAllWith_<R, E, A, B>(
  as: Iterable<Managed<R, E, A>>,
  pf: (a: A) => O.Option<B>,
  __trace?: string
): Managed<R, E, readonly B[]> {
  return core.map_(collectAll(as), (x) => pipe(x, A.map(pf), A.compact))
}

/**
 * Evaluate each effect in the structure with `collectAll`, and collect
 * the results with given partial function.
 */
export function collectAllWith<A, B>(pf: (a: A) => O.Option<B>, __trace?: string) {
  return <R, E>(as: Iterable<Managed<R, E, A>>) => collectAllWith_(as, pf, __trace)
}

/**
 * Evaluate each effect in the structure with `collectAll`, and collect
 * the results with given partial function.
 */
export function collectAllWithPar_<R, E, A, B>(
  as: Iterable<Managed<R, E, A>>,
  pf: (a: A) => O.Option<B>,
  __trace?: string
): Managed<R, E, readonly B[]> {
  return core.map_(collectAllPar(as), (x) => pipe(x, A.map(pf), A.compact))
}

/**
 * Evaluate each effect in the structure with `collectAll`, and collect
 * the results with given partial function.
 */
export function collectAllWithPar<A, B>(pf: (a: A) => O.Option<B>, __trace?: string) {
  return <R, E>(as: Iterable<Managed<R, E, A>>) => collectAllWithPar_(as, pf, __trace)
}

/**
 * Evaluate each effect in the structure with `collectAllPar`, and collect
 * the results with given partial function.
 *
 * Unlike `collectAllWithPar`, this method will use at most up to `n` fibers.
 */
export function collectAllWithParN_<R, E, A, B>(
  as: Iterable<Managed<R, E, A>>,
  n: number,
  pf: (a: A) => O.Option<B>,
  __trace?: string
): Managed<R, E, readonly B[]> {
  return core.map_(collectAllParN_(as, n), (x) => pipe(x, A.map(pf), A.compact))
}

/**
 * Evaluate each effect in the structure with `collectAllPar`, and collect
 * the results with given partial function.
 *
 * Unlike `collectAllWithPar`, this method will use at most up to `n` fibers.
 *
 * @dataFirst collectAllWithParN_
 */
export function collectAllWithParN<A, B>(
  n: number,
  pf: (a: A) => O.Option<B>,
  __trace?: string
): <R, E>(as: Iterable<Managed<R, E, A>>) => Managed<R, E, readonly B[]> {
  return (as) => collectAllWithParN_(as, n, pf, __trace)
}

/**
 * Evaluate and run each effect in the structure and collect discarding failed ones.
 */
export function collectAllSuccesses<R, E, A>(
  as: Iterable<Managed<R, E, A>>,
  __trace?: string
) {
  return collectAllWith_(
    I.map_(as, result),
    (e) => (e._tag === "Success" ? O.some(e.value) : O.none),
    __trace
  )
}

/**
 * Evaluate and run each effect in the structure in parallel, and collect discarding failed ones.
 */
export function collectAllSuccessesPar<R, E, A>(
  as: Iterable<Managed<R, E, A>>,
  __trace?: string
) {
  return collectAllWithPar_(
    I.map_(as, result),
    (e) => (e._tag === "Success" ? O.some(e.value) : O.none),
    __trace
  )
}

/**
 * Evaluate and run each effect in the structure in parallel, and collect discarding failed ones.
 *
 * Unlike `collectAllSuccessesPar`, this method will use at most up to `n` fibers.
 *
 * @dataFirst collectAllSuccessesParN_
 */
export function collectAllSuccessesParN(n: number, __trace?: string) {
  return <R, E, A>(as: Iterable<Managed<R, E, A>>) =>
    collectAllSuccessesParN_(as, n, __trace)
}

/**
 * Evaluate and run each effect in the structure in parallel, and collect discarding failed ones.
 *
 * Unlike `collectAllSuccessesPar`, this method will use at most up to `n` fibers.
 */
export function collectAllSuccessesParN_<R, E, A>(
  as: Iterable<Managed<R, E, A>>,
  n: number,
  __trace?: string
) {
  return collectAllWithParN_(
    I.map_(as, result),
    n,
    (e) => (e._tag === "Success" ? O.some(e.value) : O.none),
    __trace
  )
}

/**
 * Creates an effect that only executes the provided function as its
 * release action.
 */
export function finalizerExit<R, X>(
  f: (exit: Ex.Exit<any, any>) => T.RIO<R, X>,
  __trace?: string
): RIO<R, void> {
  return makeExit_(T.unit, (_, e) => f(e), __trace)
}

/**
 * Creates an effect that only executes the provided finalizer as its
 * release action.
 */
export function finalizer<R, X>(f: T.RIO<R, X>, __trace?: string): RIO<R, void> {
  return finalizerExit(() => f, __trace)
}

/**
 * Folds an Iterable[A] using an effectual function f, working sequentially from left to right.
 */
export function reduce_<A, Z, R, E>(
  i: Iterable<A>,
  zero: Z,
  f: (z: Z, a: A) => Managed<R, E, Z>,
  __trace?: string
): Managed<R, E, Z> {
  return A.reduce_(Array.from(i), succeed(zero) as Managed<R, E, Z>, (acc, el) =>
    core.chain_(acc, (a) => f(a, el))
  )
}

/**
 * Folds an Iterable[A] using an effectual function f, working sequentially from left to right.
 *
 * @dataFirst reduce_
 */
export function reduce<Z, R, E, A>(
  zero: Z,
  f: (z: Z, a: A) => Managed<R, E, Z>,
  __trace?: string
) {
  return (i: Iterable<A>) => reduce_(i, zero, f, __trace)
}

/**
 * Folds an Iterable[A] using an effectual function f, working sequentially from left to right.
 */
export function reduceRight_<A, Z, R, E>(
  i: Iterable<A>,
  zero: Z,
  f: (a: A, z: Z) => Managed<R, E, Z>,
  __trace?: string
): Managed<R, E, Z> {
  return A.reduceRight_(Array.from(i), succeed(zero) as Managed<R, E, Z>, (el, acc) =>
    core.chain_(acc, (a) => f(el, a))
  )
}

/**
 * Folds an Iterable[A] using an effectual function f, working sequentially from left to right.
 *
 * @dataFirst reduceRight_
 */
export function reduceRight<Z, R, E, A>(zero: Z, f: (a: A, z: Z) => Managed<R, E, Z>) {
  return (i: Iterable<A>) => reduceRight_(i, zero, f)
}

/**
 * Reduces an `Iterable[IO]` to a single `IO`, working sequentially.
 */
export function reduceAll_<R, E, A>(
  as: NA.NonEmptyArray<Managed<R, E, A>>,
  f: (acc: A, a: A) => A
): Managed<R, E, A> {
  return A.reduce_(NA.tail(as), NA.head(as), (acc, a) => core.zipWith_(acc, a, f))
}

/**
 * Reduces an `Iterable[IO]` to a single `IO`, working sequentially.
 *
 * @dataFirst reduceAll_
 */
export function reduceAll<A>(f: (acc: A, a: A) => A) {
  return <R, E>(as: NA.NonEmptyArray<Managed<R, E, A>>) => reduceAll_(as, f)
}

/**
 * Reduces an `Iterable[IO]` to a single `IO`, working in parallel.
 */
export function reduceAllPar_<R, E, A>(
  as: NA.NonEmptyArray<Managed<R, E, A>>,
  f: (acc: A, a: A) => A
): Managed<R, E, A> {
  return core.mapM_(core.makeManagedReleaseMap(T.parallel), (parallelReleaseMap) =>
    T.provideSome_(
      T.reduceAllPar_(
        NA.map_(as, (_) => T.map_(_.effect, ([_, a]) => a)),
        f
      ),
      (r: R) => tuple(r, parallelReleaseMap)
    )
  )
}

/**
 * Reduces an `Iterable[IO]` to a single `IO`, working in parallel.
 *
 * @dataFirst reduceAllPar_
 */
export function reduceAllPar<A>(f: (acc: A, a: A) => A) {
  return <R, E>(as: NA.NonEmptyArray<Managed<R, E, A>>) => reduceAllPar_(as, f)
}

/**
 * Reduces an `Iterable[IO]` to a single `IO`, working in up to `n` fibers in parallel.
 */
export function reduceAllParN_<R, E, A>(
  as: NA.NonEmptyArray<Managed<R, E, A>>,
  n: number,
  f: (acc: A, a: A) => A
): Managed<R, E, A> {
  return core.mapM_(core.makeManagedReleaseMap(T.parallel), (parallelReleaseMap) =>
    T.provideSome_(
      T.reduceAllParN_(
        NA.map_(as, (_) => T.map_(_.effect, ([_, a]) => a)),
        n,
        f
      ),
      (r: R) => tuple(r, parallelReleaseMap)
    )
  )
}

/**
 * Reduces an `Iterable[IO]` to a single `IO`, working in up to `n` fibers in parallel.
 *
 * @dataFirst reduceAllParN_
 */
export function reduceAllParN<A>(n: number, f: (acc: A, a: A) => A) {
  return <R, E>(as: NA.NonEmptyArray<Managed<R, E, A>>): Managed<R, E, A> =>
    reduceAllParN_(as, n, f)
}

/**
 * Merges an `Iterable[IO]` to a single IO, working sequentially.
 *
 * @dataFirst mergeAll_
 */
export function mergeAll<A, B>(zero: B, f: (b: B, a: A) => B) {
  return <R, E>(as: Iterable<Managed<R, E, A>>): Managed<R, E, B> =>
    mergeAll_(as, zero, f)
}

/**
 * Merges an `Iterable[IO]` to a single IO, working sequentially.
 */
export function mergeAll_<R, E, A, B>(
  as: Iterable<Managed<R, E, A>>,
  zero: B,
  f: (b: B, a: A) => B
) {
  return I.reduce_(as, succeed(zero) as Managed<R, E, B>, (b, a) =>
    core.zipWith_(b, a, f)
  )
}

/**
 * Merges an `Iterable[IO]` to a single IO, working in parallel.
 *
 * Due to the parallel nature of this combinator, `f` must be both:
 * - commutative: `f(a, b) == f(b, a)`
 * - associative: `f(a, f(b, c)) == f(f(a, b), c)`
 *
 * It's unsafe to execute side effects inside `f`, as `f` may be executed
 * more than once for some of `in` elements during effect execution.
 *
 * @dataFirst mergeAllPar_
 */
export function mergeAllPar<A, B>(zero: B, f: (b: B, a: A) => B) {
  return <R, E>(as: Iterable<Managed<R, E, A>>): Managed<R, E, B> =>
    mergeAllPar_(as, zero, f)
}

/**
 * Merges an `Iterable[IO]` to a single IO, working in parallel.
 *
 * Due to the parallel nature of this combinator, `f` must be both:
 * - commutative: `f(a, b) == f(b, a)`
 * - associative: `f(a, f(b, c)) == f(f(a, b), c)`
 *
 * It's unsafe to execute side effects inside `f`, as `f` may be executed
 * more than once for some of `in` elements during effect execution.
 */
export function mergeAllPar_<R, E, A, B>(
  as: Iterable<Managed<R, E, A>>,
  zero: B,
  f: (b: B, a: A) => B
) {
  return core.mapM_(core.makeManagedReleaseMap(T.parallel), (parallelReleaseMap) =>
    T.provideSome_(
      T.mergeAllPar_(
        I.map_(as, (_) => T.map_(_.effect, ([_, a]) => a)),
        zero,
        f
      ),
      (r: R) => tuple(r, parallelReleaseMap)
    )
  )
}

/**
 * Merges an `Iterable[IO]` to a single IO, working in with up to `n` fibers in parallel.
 *
 * Due to the parallel nature of this combinator, `f` must be both:
 * - commutative: `f(a, b) == f(b, a)`
 * - associative: `f(a, f(b, c)) == f(f(a, b), c)`
 *
 * It's unsafe to execute side effects inside `f`, as `f` may be executed
 * more than once for some of `in` elements during effect execution.
 *
 * @dataFirst mergeAllParN_
 */
export function mergeAllParN<A, B>(n: number, zero: B, f: (b: B, a: A) => B) {
  return <R, E>(as: Iterable<Managed<R, E, A>>): Managed<R, E, B> =>
    mergeAllParN_(as, n, zero, f)
}

/**
 * Merges an `Iterable[IO]` to a single IO, working in with up to `n` fibers in parallel.
 *
 * Due to the parallel nature of this combinator, `f` must be both:
 * - commutative: `f(a, b) == f(b, a)`
 * - associative: `f(a, f(b, c)) == f(f(a, b), c)`
 *
 * It's unsafe to execute side effects inside `f`, as `f` may be executed
 * more than once for some of `in` elements during effect execution.
 */
export function mergeAllParN_<R, E, A, B>(
  as: Iterable<Managed<R, E, A>>,
  n: number,
  zero: B,
  f: (b: B, a: A) => B
): Managed<R, E, B> {
  return core.mapM_(core.makeManagedReleaseMap(T.parallel), (parallelReleaseMap) =>
    T.provideSome_(
      T.mergeAllParN_(
        I.map_(as, (_) => T.map_(_.effect, ([_, a]) => a)),
        n,
        zero,
        f
      ),
      (r: R) => tuple(r, parallelReleaseMap)
    )
  )
}

/**
 * A scope in which Managed values can be safely allocated. Passing a managed
 * resource to the `apply` method will return an effect that allocates the resource
 * and returns it with an early-release handle.
 */
export interface Scope {
  <R, E, A>(ma: Managed<R, E, A>): T.Effect<R, E, readonly [RM.Finalizer, A]>
}

/**
 * Creates a scope in which resources can be safely allocated into together with a release action.
 */
export const scope: Managed<unknown, never, Scope> = core.map_(
  releaseMap,
  (finalizers) => <R, E, A>(
    ma: Managed<R, E, A>
  ): T.Effect<R, E, readonly [RM.Finalizer, A]> =>
    T.chain_(T.environment<R>(), (r) =>
      T.provideAll_(ma.effect, [r, finalizers] as const)
    )
)

/**
 * Locally installs a supervisor and an effect that succeeds with all the
 * children that have been forked in the returned effect.
 */
export function withChildren<R, E, A>(
  get: (io: T.Effect<unknown, never, HashSet<F.Runtime<any, any>>>) => Managed<R, E, A>
): Managed<R, E, A> {
  return unwrap(
    T.map_(
      track,
      (supervisor) =>
        new Managed(
          T.supervised(supervisor)(
            get(
              T.chain_(supervisor.value, (children) =>
                T.map_(T.descriptor, (d) => HS.filter_(children, (_) => _.id !== d.id))
              )
            ).effect
          )
        )
    )
  )
}

/**
 * Unwraps a `Managed` that is inside an `Effect`.
 */
export function unwrap<R, E, A>(
  fa: T.Effect<R, E, Managed<R, E, A>>
): Managed<R, E, A> {
  return flatten(fromEffect(fa))
}

/**
 * Creates a `Managed` from an `AutoCloseable` resource. The resource's `close`
 * method will be used as the release action.
 */
export function fromAutoClosable<R, E, A extends { readonly close: () => void }>(
  fa: T.Effect<R, E, A>
) {
  return core.make_(fa, (a) => T.effectTotal(() => a.close()))
}

/**
 * Creates a `Managed` from an `AutoCloseable` resource. The resource's `close`
 * method will be used as the release action.
 */
export function fromAutoClosableM<
  R,
  E,
  R1,
  A extends { readonly close: T.Effect<R1, never, any> }
>(fa: T.Effect<R, E, A>) {
  return core.make_(fa, (a) => a.close)
}

/**
 * Returns an effect that is interrupted as if by the fiber calling this
 * method.
 */
export const interrupt = core.chain_(fromEffect(T.descriptor), (d) => interruptAs(d.id))

/**
 * Returns an effect that is interrupted as if by the specified fiber.
 */
export function interruptAs(id: FiberID) {
  return halt(C.interrupt(id))
}
