/* eslint-disable prefer-const */
import * as E from "../../../Either"
import { Stack } from "../../Fiber/context"

/**
 * `XPure[S1, S2, R, E, A]` is a purely functional description of a computation
 * that requires an environment `R` and an initial state `S1` and may either
 * fail with an `E` or succeed with an updated state `S2` and an `A`. Because
 * of its polymorphism `XPure` can be used to model a variety of effects
 * including context, state, and failure.
 */
export abstract class XPure<S1, S2, R, E, A> {
  readonly _S1!: (_: S1) => void
  readonly _S2!: () => S2
  readonly _R!: (_: R) => void
  readonly _E!: () => E
  readonly _A!: () => A
}

function concrete<S1, S2, R, E, A>(
  _: XPure<S1, S2, R, E, A>
): Concrete<S1, S2, R, E, A> {
  return _ as any
}

class Succeed<A> extends XPure<unknown, never, unknown, never, A> {
  readonly _tag = "Succeed"

  constructor(readonly a: A) {
    super()
  }
}

class Fail<E> extends XPure<unknown, never, unknown, E, never> {
  readonly _tag = "Fail"

  constructor(readonly e: E) {
    super()
  }
}

class Modify<S1, S2, E, A> extends XPure<S1, S2, unknown, E, A> {
  readonly _tag = "Modify"

  constructor(readonly run: (s1: S1) => readonly [S2, A]) {
    super()
  }
}

class FlatMap<S1, S2, S3, R, R1, E, E1, A, B> extends XPure<S1, S3, R & R1, E1 | E, B> {
  readonly _tag = "FlatMap"

  constructor(
    readonly value: XPure<S1, S2, R, E, A>,
    readonly cont: (a: A) => XPure<S2, S3, R1, E1, B>
  ) {
    super()
  }
}

class Fold<S1, S2, S3, R, E1, E2, A, B> extends XPure<S1, S3, R, E2, B> {
  readonly _tag = "Fold"

  constructor(
    readonly value: XPure<S1, S2, R, E1, A>,
    readonly failure: (e: E1) => XPure<S1, S3, R, E2, B>,
    readonly success: (a: A) => XPure<S2, S3, R, E2, B>
  ) {
    super()
  }
}

class Access<S1, S2, R, E, A> extends XPure<S1, S2, R, E, A> {
  readonly _tag = "Access"

  constructor(readonly access: (r: R) => XPure<S1, S2, R, E, A>) {
    super()
  }
}

class Provide<S1, S2, R, E, A> extends XPure<S1, S2, unknown, E, A> {
  readonly _tag = "Provide"

  constructor(readonly r: R, readonly cont: XPure<S1, S2, R, E, A>) {
    super()
  }
}

type Concrete<S1, S2, R, E, A> =
  | Succeed<A>
  | Fail<E>
  | Modify<S1, S2, E, A>
  | FlatMap<S1, unknown, S2, R, R, E, E, unknown, A>
  | Fold<S1, unknown, S2, R, unknown, E, unknown, A>
  | Access<S1, S2, R, E, A>
  | Provide<S1, S2, R, E, A>

class FoldFrame {
  readonly _tag = "FoldFrame"
  constructor(
    readonly failure: (e: any) => XPure<any, any, any, any, any>,
    readonly apply: (e: any) => XPure<any, any, any, any, any>
  ) {}
}

class ApplyFrame {
  readonly _tag = "ApplyFrame"
  constructor(readonly apply: (e: any) => XPure<any, any, any, any, any>) {}
}

type Frame = FoldFrame | ApplyFrame

/**
 * Runs this computation with the specified initial state, returning either a
 * failure or the updated state and the result
 */
export function runStateEither_<S1, S2, E, A>(
  self: XPure<S1, S2, unknown, E, A>,
  s: S1
): E.Either<E, readonly [S2, A]> {
  let stack: Stack<Frame> | undefined = undefined
  let s0 = s as any
  let a = null
  let r = null
  let failed = false
  let curXPure = self as XPure<any, any, any, any, any> | undefined

  function pop() {
    const nextInstr = stack
    if (nextInstr) {
      stack = stack?.previous
    }
    return nextInstr?.value
  }

  function push(cont: Frame) {
    stack = new Stack(cont, stack)
  }

  function findNextErrorHandler() {
    let unwinding = true
    while (unwinding) {
      const nextInstr = pop()

      if (nextInstr == null) {
        unwinding = false
      } else {
        if (nextInstr._tag === "FoldFrame") {
          unwinding = false
          push(new ApplyFrame(nextInstr.failure))
        }
      }
    }
  }

  while (curXPure != null) {
    const xp = concrete(curXPure)

    switch (xp._tag) {
      case "FlatMap": {
        const nested = concrete(xp.value)
        const continuation = xp.cont

        switch (nested._tag) {
          case "Succeed": {
            curXPure = continuation(nested.a)
            break
          }
          case "Modify": {
            const updated = nested.run(s0)

            s0 = updated[0]
            a = updated[1]

            curXPure = continuation(a)
            break
          }
          default: {
            curXPure = nested
            push(new ApplyFrame(continuation))
          }
        }

        break
      }
      case "Succeed": {
        a = xp.a
        const nextInstr = pop()
        if (nextInstr) {
          curXPure = nextInstr.apply(a)
        } else {
          curXPure = undefined
        }
        break
      }
      case "Fail": {
        findNextErrorHandler()
        const nextInst = pop()
        if (nextInst) {
          curXPure = nextInst.apply(xp.e)
        } else {
          failed = true
          a = xp.e
          curXPure = undefined
        }
        break
      }
      case "Fold": {
        curXPure = xp.value
        push(new FoldFrame(xp.failure, xp.success))
        break
      }
      case "Access": {
        curXPure = xp.access(r)
        break
      }
      case "Provide": {
        r = xp.r
        curXPure = xp.cont
        break
      }
      case "Modify": {
        const updated = xp.run(s0)
        s0 = updated[0]
        a = updated[1]
        const nextInst = pop()
        if (nextInst) {
          curXPure = nextInst.apply(a)
        } else {
          curXPure = undefined
        }
        break
      }
    }
  }

  if (failed) {
    return E.left(a)
  }

  return E.right([s0, a])
}

/**
 * Runs this computation with the specified initial state, returning either a
 * failure or the updated state and the result
 */
export function runStateEither<S1>(
  s: S1
): <S2, E, A>(self: XPure<S1, S2, unknown, E, A>) => E.Either<E, readonly [S2, A]> {
  return (self) => runStateEither_(self, s)
}

/**
 * Runs this computation with the specified initial state, returning either a
 * failure or the updated state and the result
 */
export function run<S1>(s: S1) {
  return <S2, A>(self: XPure<S1, S2, unknown, never, A>): readonly [S2, A] =>
    run_(self, s)
}

/**
 * Runs this computation with the specified initial state, returning both
 * the updated state and the result.
 */
export function run_<S1, S2, A>(self: XPure<S1, S2, unknown, never, A>, s: S1) {
  return (runStateEither_(self, s) as E.Right<readonly [S2, A]>).right
}

/**
 * Runs this computation with the specified initial state, returning both
 * the updated state and the result.
 */
export function runIO<A>(self: XPure<unknown, unknown, unknown, never, A>) {
  return run_(self, {})[1]
}

/**
 * Runs this computation with the specified initial state, returning the
 * updated state and discarding the result.
 */
export function runState<S1>(s: S1) {
  return <S2, A>(self: XPure<S1, S2, unknown, never, A>) => runState_(self, s)
}

/**
 * Runs this computation with the specified initial state, returning the
 * updated state and discarding the result.
 */
export function runState_<S1, S2, A>(self: XPure<S1, S2, unknown, never, A>, s: S1) {
  return (runStateEither_(self, s) as E.Right<readonly [S2, A]>).right[0]
}

/**
 * Runs this computation with the specified initial state, returning the
 * updated state and the result.
 */
export function runStateResult<S1>(s: S1) {
  return <S2, A>(self: XPure<S1, S2, unknown, never, A>) => runStateResult_(self, s)
}

/**
 * Runs this computation with the specified initial state, returning the
 * updated state and the result.
 */
export function runStateResult_<S1, S2, A>(
  self: XPure<S1, S2, unknown, never, A>,
  s: S1
) {
  return (runStateEither_(self, s) as E.Right<readonly [S2, A]>).right
}

/**
 * Runs this computation with the specified initial state, returning the
 * result and discarding the updated state.
 */
export function runResult<S1>(s: S1) {
  return <S2, A>(self: XPure<S1, S2, unknown, never, A>) => runResult_(self, s)
}

/**
 * Runs this computation with the specified initial state, returning the
 * result and discarding the updated state.
 */
export function runResult_<S1, S2, A>(self: XPure<S1, S2, unknown, never, A>, s: S1) {
  return (runStateEither_(self, s) as E.Right<readonly [S2, A]>).right[1]
}

/**
 * Runs this computation with the specified initial state, returning the
 * updated state and discarding the result.
 */
export function runEither<E, A>(
  self: XPure<unknown, unknown, unknown, E, A>
): E.Either<E, A> {
  return E.map_(runStateEither_(self, {}), ([_, x]) => x)
}

/**
 * Extends this computation with another computation that depends on the
 * result of this computation by running the first computation, using its
 * result to generate a second computation, and running that computation.
 */
export function chain<A, S2, S3, R1, E1, B>(f: (a: A) => XPure<S2, S3, R1, E1, B>) {
  return <S1, R, E>(self: XPure<S1, S2, R, E, A>): XPure<S1, S3, R & R1, E | E1, B> =>
    new FlatMap(self, f)
}

/**
 * Extends this computation with another computation that depends on the
 * result of this computation by running the first computation, using its
 * result to generate a second computation, and running that computation.
 */
export function chain_<S1, R, E, A, S2, S3, R1, E1, B>(
  self: XPure<S1, S2, R, E, A>,
  f: (a: A) => XPure<S2, S3, R1, E1, B>
): XPure<S1, S3, R & R1, E | E1, B> {
  return new FlatMap(self, f)
}

/**
 * Returns a computation that effectfully "peeks" at the success of this one.
 */
export function tap<A, S2, S3, R1, E1>(f: (a: A) => XPure<S2, S3, R1, E1, any>) {
  return <S1, R, E>(self: XPure<S1, S2, R, E, A>): XPure<S1, S3, R & R1, E | E1, A> =>
    tap_(self, f)
}

/**
 * Returns a computation that effectfully "peeks" at the success of this one.
 */
export function tap_<S1, R, E, A, S2, S3, R1, E1>(
  self: XPure<S1, S2, R, E, A>,
  f: (a: A) => XPure<S2, S3, R1, E1, any>
): XPure<S1, S3, R & R1, E | E1, A> {
  return chain_(self, (a) => map_(f(a), () => a))
}

/**
 * Constructs a computation that always succeeds with the specified value,
 * passing the state through unchanged.
 */
export function succeed<A, S, S1 = S>(a: A): XPure<S, S1, unknown, never, A> {
  return new Succeed(a)
}

/**
 * Constructs a computation that always succeeds with the specified value,
 * passing the state through unchanged.
 */
export function fail<E>(a: E): XPure<unknown, never, unknown, E, never> {
  return new Fail(a)
}

/**
 * Extends this computation with another computation that depends on the
 * result of this computation by running the first computation, using its
 * result to generate a second computation, and running that computation.
 */
export function map_<S1, R, E, A, S2, B>(self: XPure<S1, S2, R, E, A>, f: (a: A) => B) {
  return chain_(self, (a) => succeed(f(a)))
}

/**
 * Extends this computation with another computation that depends on the
 * result of this computation by running the first computation, using its
 * result to generate a second computation, and running that computation.
 */
export function map<A, B>(f: (a: A) => B) {
  return <S1, S2, R, E>(self: XPure<S1, S2, R, E, A>) =>
    chain_(self, (a) => succeed(f(a)))
}

/**
 * Recovers from errors by accepting one computation to execute for the case
 * of an error, and one computation to execute for the case of success.
 */
export function foldM_<S1, S2, R, E, A, S3, R1, E1, B, S4, R2, E2, C>(
  self: XPure<S1, S2, R, E, A>,
  failure: (e: E) => XPure<S1, S3, R1, E1, B>,
  success: (a: A) => XPure<S2, S4, R2, E2, C>
): XPure<S1, S3 | S4, R & R1 & R2, E1 | E2, B | C> {
  return new Fold(
    self as XPure<S1, S2, R & R1 & R2, E, A>,
    failure as (e: E) => XPure<S1, S3 | S4, R1 & R2, E1 | E2, B | C>,
    success
  )
}

/**
 * Recovers from errors by accepting one computation to execute for the case
 * of an error, and one computation to execute for the case of success.
 */
export function foldM<S1, S2, E, A, S3, R1, E1, B, S4, R2, E2, C>(
  failure: (e: E) => XPure<S1, S3, R1, E1, B>,
  success: (a: A) => XPure<S2, S4, R2, E2, C>
) {
  return <R>(self: XPure<S1, S2, R, E, A>) => foldM_(self, failure, success)
}

/**
 * Recovers from all errors.
 */
export function catchAll<S1, E, S3, R1, E1, B>(
  failure: (e: E) => XPure<S1, S3, R1, E1, B>
) {
  return <S2, R, A>(self: XPure<S1, S2, R, E, A>) => catchAll_(self, failure)
}

/**
 * Recovers from all errors.
 */
export function catchAll_<S1, S2, R, E, A, S3, R1, E1, B>(
  self: XPure<S1, S2, R, E, A>,
  failure: (e: E) => XPure<S1, S3, R1, E1, B>
) {
  return foldM_(self, failure, (a) => succeed(a))
}

/**
 * Returns a computation whose error and success channels have been mapped
 * by the specified functions, `f` and `g`.
 */
export function bimap<E, A, E1, A1>(f: (e: E) => E1, g: (a: A) => A1) {
  return <S1, S2, R>(self: XPure<S1, S2, R, E, A>) => bimap_(self, f, g)
}

/**
 * Returns a computation whose error and success channels have been mapped
 * by the specified functions, `f` and `g`.
 */
export function bimap_<S1, S2, R, E, A, E1, A1>(
  self: XPure<S1, S2, R, E, A>,
  f: (e: E) => E1,
  g: (a: A) => A1
) {
  return foldM_(
    self,
    (e) => fail(f(e)),
    (a) => succeed(g(a))
  )
}

/**
 * Transforms the error type of this computation with the specified
 * function.
 */
export function mapError<E, E1>(f: (e: E) => E1) {
  return <S1, S2, R, A>(self: XPure<S1, S2, R, E, A>) => mapError_(self, f)
}

/**
 * Transforms the error type of this computation with the specified
 * function.
 */
export function mapError_<S1, S2, R, E, A, E1>(
  self: XPure<S1, S2, R, E, A>,
  f: (e: E) => E1
) {
  return catchAll_(self, (e) => fail(f(e)))
}

/**
 * Constructs a computation from the specified modify function.
 */
export function modify<S1, S2, A>(
  f: (s: S1) => readonly [S2, A]
): XPure<S1, S2, unknown, never, A> {
  return new Modify(f)
}

/**
 * Constructs a computation from the specified update function.
 */
export function update<S1, S2>(f: (s: S1) => S2): XPure<S1, S2, unknown, never, void> {
  return modify((s) => [f(s), undefined])
}

/**
 * Constructs a computation that always returns the `Unit` value, passing the
 * state through unchanged.
 */
export const unit = <S, S1 = S>() => succeed<void, S, S1>(undefined)

/**
 * Transforms the initial state of this computation` with the specified
 * function.
 */
export function contramapInput<S0, S1>(f: (s: S0) => S1) {
  return <S2, R, E, A>(self: XPure<S1, S2, R, E, A>) => chain_(update(f), () => self)
}

/**
 * Transforms the initial state of this computation` with the specified
 * function.
 */
export function contramapEnv<R0, R1>(f: (s: R0) => R1) {
  return <S1, S2, E, A>(self: XPure<S1, S2, R1, E, A>) =>
    accessM((r: R0) => provideAll(f(r))(self))
}

/**
 * Provides this computation with its required environment.
 */
export function provideAll<R>(r: R) {
  return <S1, S2, E, A>(self: XPure<S1, S2, R, E, A>): XPure<S1, S2, unknown, E, A> =>
    new Provide(r, self)
}

/**
 * Access the environment monadically
 */
export function accessM<R, S1, S2, R1, E, A>(
  f: (_: R) => XPure<S1, S2, R1, E, A>
): XPure<S1, S2, R1 & R, E, A> {
  return new Access<S1, S2, R1 & R, E, A>(f)
}

/**
 * Access the environment with the function f
 */
export function access<R, A, S, S1 = S>(f: (_: R) => A): XPure<S, S1, R, never, A> {
  return accessM((r: R) => succeed(f(r)))
}

/**
 * Access the environment
 */
export function environment<R>(): <S, S1 = S>() => XPure<S, S1, R, never, R> {
  return () => accessM((r: R) => succeed(r))
}

/**
 * Combines this computation with the specified computation, passing the
 * updated state from this computation to that computation and combining the
 * results of both using the specified function.
 */
export function zipWith<S2, S3, R1, E1, A, B, C>(
  that: XPure<S2, S3, R1, E1, B>,
  f: (a: A, b: B) => C
) {
  return <S1, R, E>(self: XPure<S1, S2, R, E, A>): XPure<S1, S3, R & R1, E1 | E, C> =>
    zipWith_(self, that, f)
}

/**
 * Combines this computation with the specified computation, passing the
 * updated state from this computation to that computation and combining the
 * results of both using the specified function.
 */
export function zipWith_<S1, S2, R, E, A, S3, R1, E1, B, C>(
  self: XPure<S1, S2, R, E, A>,
  that: XPure<S2, S3, R1, E1, B>,
  f: (a: A, b: B) => C
) {
  return chain_(self, (a) => map_(that, (b) => f(a, b)))
}

/**
 * Combines this computation with the specified computation, passing the
 * updated state from this computation to that computation and combining the
 * results of both into a tuple.
 */
export function zip<S2, S3, R1, E1, B>(that: XPure<S2, S3, R1, E1, B>) {
  return <S1, R, E, A>(self: XPure<S1, S2, R, E, A>) => zip_(self, that)
}

/**
 * Combines this computation with the specified computation, passing the
 * updated state from this computation to that computation and combining the
 * results of both into a tuple.
 */
export function zip_<S1, S2, R, E, A, S3, R1, E1, B>(
  self: XPure<S1, S2, R, E, A>,
  that: XPure<S2, S3, R1, E1, B>
) {
  return zipWith_(self, that, (a, b) => [a, b] as const)
}
