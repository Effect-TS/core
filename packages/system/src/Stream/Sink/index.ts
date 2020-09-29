import * as T from "../_internal/effect"
import * as M from "../_internal/managed"
import * as A from "../../Array"
import * as C from "../../Cause/core"
import * as E from "../../Either"
import * as Ex from "../../Exit/api"
import * as F from "../../Fiber/api"
import { pipe } from "../../Function"
import * as O from "../../Option"
import * as R from "../../Ref"
import * as Push from "../Push"

// Important notes while writing sinks and combinators:
// - What return values for sinks mean:
//   Effect.unit - "need more values"
//   Effect.fail([Either.Right(z), l]) - "ended with z and emit leftover l"
//   Effect.fail([Either.Left(e), l]) - "failed with e and emit leftover l"
// - Result of processing of the stream using the sink must not depend on how the stream is chunked
//   (chunking-invariance)
//   pipe(stream, run(sink), Effect.either) === pipe(stream, chunkN(1), run(sink), Effect.either)
// - Sinks should always end when receiving a `None`. It is a defect to not end with some
//   sort of result (even a failure) when receiving a `None`.
// - Sinks can assume they will not be pushed again after emitting a value.
export class Sink<R, E, I, L, Z> {
  constructor(readonly push: M.Managed<R, never, Push.Push<R, E, I, L, Z>>) {}
}

/**
 * Creates a sink from a Push
 */
export const fromPush = <R, E, I, L, Z>(push: Push.Push<R, E, I, L, Z>) =>
  new Sink(M.succeedNow(push))

/**
 * A sink that immediately ends with the specified value.
 */
export const succeed = <Z, I>(z: Z): Sink<unknown, never, I, I, Z> =>
  fromPush<unknown, never, I, I, Z>((c) => {
    const leftover = O.fold_(
      c,
      () => [] as A.Array<I>,
      (x) => x
    )

    return Push.emit(z, leftover)
  })

/**
 * A sink that effectfully folds its input chunks with the provided function, termination predicate and initial state.
 * `contFn` condition is checked only for the initial value and at the end of processing of each chunk.
 * `f` and `contFn` must preserve chunking-invariance.
 */
export const foldArraysM = <Z>(z: Z) => (contFn: (s: Z) => boolean) => <I, R, E>(
  f: (s: Z, i: A.Array<I>) => T.Effect<R, E, Z>
): Sink<R, E, I, I, Z> => {
  if (contFn(z)) {
    return new Sink(
      pipe(
        M.do,
        M.bind("state", () => pipe(R.makeRef(z), T.toManaged())),
        M.let("push", ({ state }) => (is: O.Option<A.Array<I>>) => {
          switch (is._tag) {
            case "None": {
              return pipe(
                state.get,
                T.chain((s) => Push.emit(s, []))
              )
            }
            case "Some": {
              return pipe(
                state.get,
                T.chain((s) =>
                  pipe(
                    f(s, is.value),
                    T.mapError(
                      (e) => [E.left(e), []] as [E.Either<E, never>, A.Array<I>]
                    ),
                    T.chain((s) =>
                      contFn(s)
                        ? pipe(
                            state.set(s),
                            T.chain(() => Push.more)
                          )
                        : Push.emit(s, [])
                    )
                  )
                )
              )
            }
          }
        }),
        M.map(({ push }) => push)
      )
    )
  } else {
    return succeed<Z, I>(z)
  }
}

/**
 * A sink that folds its input chunks with the provided function, termination predicate and initial state.
 * `contFn` condition is checked only for the initial value and at the end of processing of each chunk.
 * `f` and `contFn` must preserve chunking-invariance.
 */
export const foldArrays = <Z>(z: Z) => (contFn: (s: Z) => boolean) => <I>(
  f: (s: Z, i: A.Array<I>) => Z
): Sink<unknown, never, I, I, Z> =>
  foldArraysM(z)(contFn)((z, i: A.Array<I>) => T.succeedNow(f(z, i)))

/**
 * A sink that folds its input chunks with the provided function and initial state.
 * `f` must preserve chunking-invariance.
 */
export const foldLeftArrays = <Z>(z: Z) => <I>(f: (s: Z, i: A.Array<I>) => Z) =>
  foldArrays(z)(() => true)(f)

/**
 * A sink that collects all of its inputs into an array.
 */
export const collectAll = <A>(): Sink<unknown, never, A, A, A.Array<A>> =>
  foldLeftArrays([] as A.Array<A>)((s, i: A.Array<A>) => [...s, ...i])

/**
 * Runs both sinks in parallel on the input, returning the result or the error from the
 * one that finishes first.
 */
export const raceBoth = <R1, E1, I1 extends I, L1, Z1, I>(
  that: Sink<R1, E1, I1, L1, Z1>
) => <R, E, L, Z>(
  self: Sink<R, E, I, L, Z>
): Sink<R1 & R, E1 | E, I1, L1 | L, E.Either<Z, Z1>> =>
  new Sink(
    pipe(
      M.do,
      M.bind("p1", () => self.push),
      M.bind("p2", () => that.push),
      M.map(({ p1, p2 }) => (i: O.Option<A.Array<I1>>): T.Effect<
        R1 & R,
        readonly [E.Either<E | E1, E.Either<Z, Z1>>, A.Array<L | L1>],
        void
      > =>
        T.raceWith(
          p1(i),
          p2(i),
          (res1, fib2) =>
            Ex.foldM_(
              res1,
              (f) =>
                T.zipSecond_(
                  F.interrupt(fib2),
                  T.halt(
                    pipe(
                      f,
                      C.map(([r, leftover]) => [E.map_(r, E.left), leftover] as const)
                    )
                  )
                ),
              () =>
                T.mapError_(
                  F.join(fib2),
                  ([r, leftover]) => [E.map_(r, E.right), leftover] as const
                )
            ),
          (res2, fib1) =>
            Ex.foldM_(
              res2,
              (f) =>
                T.zipSecond_(
                  F.interrupt(fib1),
                  T.halt(
                    pipe(
                      f,
                      C.map(([r, leftover]) => [E.map_(r, E.right), leftover] as const)
                    )
                  )
                ),
              () =>
                T.mapError_(
                  F.join(fib1),
                  ([r, leftover]) => [E.map_(r, E.left), leftover] as const
                )
            )
        )
      )
    )
  )

/**
 * A sink that executes the provided effectful function for every element fed to it.
 */
export const foreach = <I, R1, E1>(f: (i: I) => T.Effect<R1, E1, any>) => {
  const go = (
    chunk: A.Array<I>,
    idx: number,
    len: number
  ): T.Effect<R1, [E.Either<E1, never>, A.Array<I>], void> => {
    if (idx === len) {
      return Push.more
    } else {
      return pipe(
        f(chunk[idx]),
        T.foldM(
          (e) => Push.fail(e, A.dropLeft_(chunk, idx + 1)),
          () => go(chunk, idx + 1, len)
        )
      )
    }
  }

  return fromPush(
    O.fold(
      () => Push.emit<never, void>(undefined, []),
      (is: A.Array<I>) => go(is, 0, is.length)
    )
  )
}
