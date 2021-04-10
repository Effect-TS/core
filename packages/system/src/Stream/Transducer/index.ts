// tracing: off

import "../../Operator"

import type * as C from "../../Cause"
import * as A from "../../Collections/Immutable/Chunk"
import * as Map from "../../Collections/Immutable/Map"
import * as Ex from "../../Exit"
import type { Predicate, Refinement } from "../../Function"
import { not, pipe, tuple } from "../../Function"
import type { Finalizer } from "../../Managed/ReleaseMap"
import * as O from "../../Option"
import * as RM from "../../RefM"
import * as T from "../_internal/effect"
import * as M from "../_internal/managed"
import * as R from "../_internal/ref"

// Contract notes for transducers:
// - When a None is received, the transducer must flush all of its internal state
//   and remain empty until subsequent Some(Chunk) values.
//
//   Stated differently, after a first push(None), all subsequent push(None) must
//   result in empty [].
export class Transducer<R, E, I, O> {
  constructor(
    readonly push: M.Managed<
      R,
      never,
      (c: O.Option<A.Chunk<I>>) => T.Effect<R, E, A.Chunk<O>>
    >
  ) {}
}

/**
 * Contract notes for transducers:
 * - When a None is received, the transducer must flush all of its internal state
 *   and remain empty until subsequent Some(Chunk) values.
 *
 *   Stated differently, after a first push(None), all subsequent push(None) must
 *   result in empty [].
 */
export const transducer = <R, E, I, O, R1>(
  push: M.Managed<R, never, (c: O.Option<A.Chunk<I>>) => T.Effect<R1, E, A.Chunk<O>>>
) => new Transducer<R & R1, E, I, O>(push)

/**
 * Compose this transducer with another transducer, resulting in a composite transducer.
 */
export const then = <R1, E1, O, O1>(that: Transducer<R1, E1, O, O1>) => <R, E, I>(
  self: Transducer<R, E, I, O>
): Transducer<R & R1, E1 | E, I, O1> =>
  transducer(
    pipe(
      self.push,
      M.zipWith(that.push, (pushLeft, pushRight) =>
        O.fold(
          () =>
            pipe(
              pushLeft(O.none),
              T.chain((cl) =>
                A.isEmpty(cl)
                  ? pushRight(O.none)
                  : pipe(pushRight(O.some(cl)), T.zipWith(pushRight(O.none), A.concat_))
              )
            ),
          (inputs) =>
            pipe(
              pushLeft(O.some(inputs)),
              T.chain((cl) => pushRight(O.some(cl)))
            )
        )
      )
    )
  )

/**
 * Transforms the outputs of this transducer.
 */
export function map_<R, E, I, O, O1>(
  fa: Transducer<R, E, I, O>,
  f: (o: O) => O1
): Transducer<R, E, I, O1> {
  return new Transducer(
    M.map_(fa.push, (push) => (input) => T.map_(push(input), A.map(f)))
  )
}

/**
 * Transforms the outputs of this transducer.
 */
export function map<O, P>(
  f: (o: O) => P
): <R, E, I>(fa: Transducer<R, E, I, O>) => Transducer<R, E, I, P> {
  return (fa) => map_(fa, f)
}

/**
 * Transforms the chunks emitted by this transducer.
 */
export function mapChunks_<R, E, I, O, O1>(
  fa: Transducer<R, E, I, O>,
  f: (chunks: A.Chunk<O>) => A.Chunk<O1>
): Transducer<R, E, I, O1> {
  return new Transducer(M.map_(fa.push, (push) => (input) => T.map_(push(input), f)))
}

/**
 * Transforms the chunks emitted by this transducer.
 */
export function mapChunks<O, O1>(
  f: (chunks: A.Chunk<O>) => A.Chunk<O1>
): <R, E, I>(fa: Transducer<R, E, I, O>) => Transducer<R, E, I, O1> {
  return (fa) => mapChunks_(fa, f)
}

/**
 * Effectfully transforms the chunks emitted by this transducer.
 */
export function mapChunksM_<R, E, I, O, R1, E1, O1>(
  fa: Transducer<R, E, I, O>,
  f: (chunk: A.Chunk<O>) => T.Effect<R1, E1, A.Chunk<O1>>
): Transducer<R & R1, E | E1, I, O1> {
  return new Transducer(M.map_(fa.push, (push) => (input) => T.chain_(push(input), f)))
}

/**
 * Effectfully transforms the chunks emitted by this transducer.
 */
export function mapChunksM<O, R1, E1, O1>(
  f: (chunk: A.Chunk<O>) => T.Effect<R1, E1, A.Chunk<O1>>
): <R, E, I>(fa: Transducer<R, E, I, O>) => Transducer<R & R1, E | E1, I, O1> {
  return (fa) => mapChunksM_(fa, f)
}

/**
 * Effectually transforms the outputs of this transducer
 */
export function mapM_<R, E, I, O, R1, E1, O1>(
  fa: Transducer<R, E, I, O>,
  f: (o: O) => T.Effect<R1, E1, O1>
): Transducer<R & R1, E | E1, I, O1> {
  return new Transducer(
    M.map_(fa.push, (push) => (input) => T.chain_(push(input), A.mapM(f)))
  )
}

/**
 * Effectually transforms the outputs of this transducer
 */
export function mapM<O, R1, E1, O1>(
  f: (o: O) => T.Effect<R1, E1, O1>
): <R, E, I>(fa: Transducer<R, E, I, O>) => Transducer<R & R1, E | E1, I, O1> {
  return (fa) => mapM_(fa, f)
}

/**
 * Transforms the errors of this transducer.
 */
export function mapError_<R, E, I, O, E1>(
  pab: Transducer<R, E, I, O>,
  f: (e: E) => E1
): Transducer<R, E1, I, O> {
  return new Transducer(M.map_(pab.push, (push) => (is) => T.mapError_(push(is), f)))
}

/**
 * Transforms the errors of this transducer.
 */
export function mapError<E, E1>(
  f: (e: E) => E1
): <R, I, O>(pab: Transducer<R, E, I, O>) => Transducer<R, E1, I, O> {
  return (pab) => mapError_(pab, f)
}

/**
 * Creates a transducer that always fails with the specified failure.
 */
export function fail<E>(e: E): Transducer<unknown, E, unknown, never> {
  return new Transducer(M.succeed((_) => T.fail(e)))
}

/**
 * Creates a transducer that always dies with the specified exception.
 */
export function die(error: unknown): Transducer<unknown, never, unknown, never> {
  return new Transducer(M.succeed((_) => T.die(error)))
}

/**
 * Creates a transducer that always fails with the specified cause.
 */
export function halt<E>(c: C.Cause<E>): Transducer<unknown, E, unknown, never> {
  return new Transducer(M.succeed((_) => T.halt(c)))
}

/**
 * The identity transducer. Passes elements through.
 */
export function identity<I>(): Transducer<unknown, never, I, I> {
  return fromPush(O.fold(() => T.succeed(A.empty()), T.succeed))
}

/**
 * Creates a transducer from a chunk processing function.
 */
export function fromPush<R, E, I, O>(
  push: (input: O.Option<A.Chunk<I>>) => T.Effect<R, E, A.Chunk<O>>
): Transducer<R, E, I, O> {
  return new Transducer(M.succeed(push))
}

/**
 * Creates a transducer that always evaluates the specified effect.
 */
export function fromEffect<R, E, A>(
  task: T.Effect<R, E, A>
): Transducer<R, E, unknown, A> {
  return new Transducer(M.succeed((_: any) => T.map_(task, A.single)))
}

/**
 * Creates a transducer that purely transforms incoming values.
 */
export function fromFunction<I, O>(f: (i: I) => O): Transducer<unknown, never, I, O> {
  return map_(identity(), f)
}

/**
 * Creates a transducer that effectfully transforms incoming values.
 */
export function fromFunctionM<R, E, I, O>(
  f: (i: I) => T.Effect<R, E, O>
): Transducer<R, E, I, O> {
  return mapM_(identity(), f)
}

/**
 * Creates a transducer that returns the first element of the stream, if it exists.
 */
export function head<O>(): Transducer<unknown, never, O, O.Option<O>> {
  return foldLeft(O.none as O.Option<O>, (acc, o) =>
    O.fold_(
      acc,
      () => O.some(o),
      () => acc
    )
  )
}

/**
 * Creates a transducer that returns the last element of the stream, if it exists.
 */
export function last<O>(): Transducer<unknown, never, O, O.Option<O>> {
  return foldLeft(O.none as O.Option<O>, (_, o) => O.some(o))
}

/**
 * Emits the provided chunk before emitting any other value.
 */
export function prepend<O>(values: A.Chunk<O>): Transducer<unknown, never, O, O> {
  return new Transducer(
    M.map_(R.makeManagedRef(values), (state) => (is: O.Option<A.Chunk<O>>) =>
      O.fold_(
        is,
        () => R.getAndSet_(state, A.empty()),
        (os) =>
          pipe(
            state,
            R.getAndSet(A.empty()),
            T.map((c) => (A.isEmpty(c) ? os : A.concat_(c, os)))
          )
      )
    )
  )
}

/**
 * Reads the first n values from the stream and uses them to choose the transducer that will be used for the remainder of the stream.
 * If the stream ends before it has collected n values the partial chunk will be provided to f.
 */
export function branchAfter<R, E, I, O>(
  n: number,
  f: (c: A.Chunk<I>) => Transducer<R, E, I, O>
): Transducer<R, E, I, O> {
  interface Collecting {
    _tag: "Collecting"
    data: A.Chunk<I>
  }
  interface Emitting {
    _tag: "Emitting"
    finalizer: Finalizer
    push: (is: O.Option<A.Chunk<I>>) => T.Effect<R, E, A.Chunk<O>>
  }
  type State = Collecting | Emitting
  const initialState: State = {
    _tag: "Collecting",
    data: A.empty()
  }

  const toCollect = Math.max(0, n)

  return new Transducer(
    M.chain_(M.scope, (allocate) =>
      M.map_(
        RM.makeManagedRefM<State>(initialState),
        (state) => (is: O.Option<A.Chunk<I>>) =>
          O.fold_(
            is,
            () =>
              pipe(
                RM.getAndSet_(state, initialState),
                T.chain((s) => {
                  switch (s._tag) {
                    case "Collecting": {
                      return M.use_(f(s.data).push, (f) => f(O.none))
                    }
                    case "Emitting": {
                      return T.zipLeft_(s.push(O.none), s.finalizer(Ex.unit))
                    }
                  }
                })
              ),
            (data) =>
              RM.modify_(state, (s) => {
                switch (s._tag) {
                  case "Emitting": {
                    return T.map_(s.push(O.some(data)), (_) => [_, s] as const)
                  }
                  case "Collecting": {
                    if (A.isEmpty(data)) {
                      return T.succeed([A.empty<O>(), s] as const)
                    } else {
                      const remaining = toCollect - A.size(s.data)
                      if (remaining <= A.size(data)) {
                        const [newCollected, remainder] = A.splitAt_(data, remaining)
                        return T.chain_(
                          allocate(f(A.concat_(s.data, newCollected)).push),
                          ([finalizer, push]) =>
                            T.map_(
                              push(O.some(remainder)),
                              (_) => [_, { _tag: "Emitting", finalizer, push }] as const
                            )
                        )
                      } else {
                        return T.succeed([
                          A.empty(),
                          { _tag: "Collecting", data: A.concat_(s.data, data) }
                        ] as const)
                      }
                    }
                  }
                }
              })
          )
      )
    )
  )
}

/**
 * Creates a transducer that starts consuming values as soon as one fails
 * the predicate `p`.
 */
export function dropWhile<I>(
  predicate: Predicate<I>
): Transducer<unknown, never, I, I> {
  return new Transducer(
    M.map_(R.makeManagedRef(true), (dropping) => (is: O.Option<A.Chunk<I>>) =>
      O.fold_(
        is,
        () => T.succeed(A.empty()),
        (is) =>
          R.modify_(dropping, (b) => {
            switch (b) {
              case true: {
                const is1 = A.dropWhile_(is, predicate)
                return [is1, A.isEmpty(is1)]
              }
              case false: {
                return [is, false]
              }
            }
          })
      )
    )
  )
}

/**
 * Creates a transducer that starts consuming values as soon as one fails
 * the effectful predicate `p`.
 */
export function dropWhileM<R, E, I>(
  p: (i: I) => T.Effect<R, E, boolean>
): Transducer<R, E, I, I> {
  return new Transducer(
    pipe(
      M.do,
      M.bind("dropping", () => R.makeManagedRef(true)),
      M.let("push", ({ dropping }) => (is: O.Option<A.Chunk<I>>) =>
        O.fold_(
          is,
          () => T.succeed(A.empty<I>()),
          (is) =>
            pipe(
              dropping.get,
              T.chain((b) =>
                b
                  ? T.map_(
                      A.dropWhileM_(is, p),
                      (l: A.Chunk<I>) => [l, A.isEmpty(l)] as const
                    )
                  : T.succeed([is, false] as const)
              ),
              T.chain(([is, pt]) => T.as_(dropping.set(pt), is))
            )
        )
      ),
      M.map(({ push }) => push)
    )
  )
}

/**
 * Creates a transducer by folding over a structure of type `O` for as long as
 * `contFn` results in `true`. The transducer will emit a value when `contFn`
 * evaluates to `false` and then restart the folding.
 */
export function fold<I, O>(
  initial: O,
  contFn: (o: O) => boolean,
  f: (output: O, input: I) => O
): Transducer<unknown, never, I, O> {
  const go = (
    in_: A.Chunk<I>,
    state: O,
    progress: boolean
  ): readonly [A.Chunk<O>, O, boolean] => {
    return A.reduce_(
      in_,
      [A.empty<O>(), state, progress] as const,
      ([os0, state, _], i) => {
        const o = f(state, i)
        if (contFn(o)) {
          return [os0, o, true] as const
        } else {
          return [A.append_(os0, o), initial, false] as const
        }
      }
    )
  }
  return new Transducer(
    M.map_(R.makeManagedRef(O.some(initial)), (state) => (is: O.Option<A.Chunk<I>>) =>
      O.fold_(
        is,
        () =>
          pipe(R.getAndSet_(state, O.none), T.map(O.fold(() => A.empty(), A.single))),
        (in_) =>
          R.modify_(state, (s) => {
            const [o, s2, progress] = go(
              in_,
              O.getOrElse_(s, () => initial),
              O.isSome(s)
            )
            if (progress) {
              return [o, O.some(s2)]
            } else {
              return [o, O.none]
            }
          })
      )
    )
  )
}

/**
 * Creates a transducer by folding over a structure of type `O`. The transducer will
 * fold the inputs until the stream ends, resulting in a stream with one element.
 */
export function foldLeft<I, O>(
  initial: O,
  f: (output: O, input: I) => O
): Transducer<unknown, never, I, O> {
  return fold(initial, () => true, f)
}

/**
 * Creates a sink by effectfully folding over a structure of type `S`.
 */
export function foldM<R, E, I, O>(
  initial: O,
  contFn: (o: O) => boolean,
  f: (output: O, input: I) => T.Effect<R, E, O>
): Transducer<R, E, I, O> {
  const init = O.some(initial)
  const go = (
    in_: A.Chunk<I>,
    state: O,
    progress: boolean
  ): T.Effect<R, E, readonly [A.Chunk<O>, O, boolean]> =>
    A.reduce_(
      in_,
      T.succeed([A.empty(), state, progress]) as T.Effect<
        R,
        E,
        readonly [A.Chunk<O>, O, boolean]
      >,
      (b, i) =>
        T.chain_(b, ([os0, state, _]) =>
          T.map_(f(state, i), (o) => {
            if (contFn(o)) {
              return [os0, o, true] as const
            } else {
              return [A.append_(os0, o), initial, false] as const
            }
          })
        )
    )
  return new Transducer(
    M.map_(R.makeManagedRef(init), (state) => (is: O.Option<A.Chunk<I>>) =>
      O.fold_(
        is,
        () =>
          pipe(
            state,
            R.getAndSet(O.none as O.Option<O>),
            T.map(O.fold(() => A.empty(), A.single))
          ),
        (in_) =>
          pipe(
            state.get,
            T.chain((s) =>
              go(
                in_,
                O.getOrElse_(s, () => initial),
                O.isSome(s)
              )
            ),
            T.chain(([os, s, progress]) =>
              progress
                ? T.zipRight_(state.set(O.some(s)), T.succeed(os))
                : T.zipRight_(state.set(O.none), T.succeed(os))
            )
          )
      )
    )
  )
}

/**
 * Creates a transducer by effectfully folding over a structure of type `O`. The transducer will
 * fold the inputs until the stream ends, resulting in a stream with one element.
 */
export function foldLeftM<R, E, I, O>(
  initial: O,
  f: (output: O, input: I) => T.Effect<R, E, O>
): Transducer<R, E, I, O> {
  return foldM(initial, () => true, f)
}

/**
 * Creates a transducer that folds elements of type `I` into a structure
 * of type `O` until `max` elements have been folded.
 *
 * Like `foldWeighted`, but with a constant cost function of 1.
 */
export function foldUntil<I, O>(
  initial: O,
  max: number,
  f: (output: O, input: I) => O
): Transducer<unknown, never, I, O> {
  return pipe(
    fold(
      tuple(initial, 0),
      ([_, n]) => n < max,
      ([o, count], i: I) => [f(o, i), count + 1] as const
    ),
    map((t) => t[0])
  )
}

/**
 * Creates a transducer that effectfully folds elements of type `I` into a structure
 * of type `O` until `max` elements have been folded.
 *
 * Like `foldWeightedM`, but with a constant cost function of 1.
 */
export function foldUntilM<R, E, I, O>(
  initial: O,
  max: number,
  f: (output: O, input: I) => T.Effect<R, E, O>
): Transducer<R, E, I, O> {
  return pipe(
    foldM(
      tuple(initial, 0),
      ([_, n]) => n < max,
      ([o, count], i: I) => T.map_(f(o, i), (o) => [o, count + 1] as const)
    ),
    map((t) => t[0])
  )
}

/**
 * Creates a transducer that folds elements of type `I` into a structure
 * of type `O`, until `max` worth of elements (determined by the `costFn`)
 * have been folded.
 *
 * The `decompose` function will be used for decomposing elements that
 * cause an `O` aggregate to cross `max` into smaller elements.
 *
 * Be vigilant with this function, it has to generate "simpler" values
 * or the fold may never end. A value is considered indivisible if
 * `decompose` yields the empty chunk or a single-valued chunk. In
 * these cases, there is no other choice than to yield a value that
 * will cross the threshold.
 *
 * The foldWeightedDecomposeM allows the decompose function
 * to return an `Effect` value, and consequently it allows the transducer
 * to fail.
 */
export function foldWeightedDecompose<I, O>(
  initial: O,
  costFn: (output: O, input: I) => number,
  max: number,
  decompose: (input: I) => A.Chunk<I>,
  f: (output: O, input: I) => O
): Transducer<unknown, never, I, O> {
  interface FoldWeightedState {
    result: O
    cost: number
  }

  const initialState: FoldWeightedState = {
    result: initial,
    cost: 0
  }

  const go = (
    in_: A.Chunk<I>,
    os0: A.Chunk<O>,
    state: FoldWeightedState,
    dirty: boolean
  ): readonly [A.Chunk<O>, FoldWeightedState, boolean] =>
    A.reduce_(in_, [os0, state, dirty] as const, ([os0, state, _], i) => {
      const total = state.cost + costFn(state.result, i)

      if (total > max) {
        const is = decompose(i)
        if (A.size(is) <= 1 && !dirty) {
          return [
            A.append_(os0, f(state.result, !A.isEmpty(is) ? A.unsafeGet_(is, 0) : i)),
            initialState,
            false
          ] as const
        } else if (A.size(is) <= 1 && dirty) {
          const elem = !A.isEmpty(is) ? is[0] : i
          return [
            A.append_(os0, state.result),
            {
              result: f(initialState.result, elem),
              cost: costFn(initialState.result, elem)
            },
            true
          ] as const
        } else {
          return go(is, os0, state, dirty)
        }
      } else {
        return [os0, { result: f(state.result, i), cost: total }, true] as const
      }
    })

  return new Transducer(
    M.map_(
      R.makeManagedRef(O.some(initialState)),
      (state) => (is: O.Option<A.Chunk<I>>) =>
        O.fold_(
          is,
          () =>
            pipe(
              state,
              R.getAndSet(O.none as O.Option<FoldWeightedState>),
              T.map(
                O.fold(
                  () => A.empty(),
                  (s) => A.single(s.result)
                )
              )
            ),
          (in_) =>
            R.modify_(state, (s) => {
              const [o, s2, dirty] = go(
                in_,
                A.empty(),
                O.getOrElse_(s, () => initialState),
                O.isSome(s)
              )
              if (dirty) {
                return [o, O.some(s2)]
              } else {
                return [o, O.none]
              }
            })
        )
    )
  )
}

/**
 * Creates a transducer that effectfully folds elements of type `I` into a structure
 * of type `S`, until `max` worth of elements (determined by the `costFn`) have
 * been folded.
 *
 * The `decompose` function will be used for decomposing elements that
 * cause an `S` aggregate to cross `max` into smaller elements. Be vigilant with
 * this function, it has to generate "simpler" values or the fold may never end.
 * A value is considered indivisible if `decompose` yields the empty chunk or a
 * single-valued chunk. In these cases, there is no other choice than to yield
 * a value that will cross the threshold.
 *
 * See foldWeightedDecompose for an example.
 */
export function foldWeightedDecomposeM<R, E, I, O>(
  initial: O,
  costFn: (output: O, input: I) => T.Effect<R, E, number>,
  max: number,
  decompose: (input: I) => T.Effect<R, E, A.Chunk<I>>,
  f: (output: O, input: I) => T.Effect<R, E, O>
): Transducer<R, E, I, O> {
  interface FoldWeightedState {
    result: O
    cost: number
  }

  const initialState: FoldWeightedState = {
    result: initial,
    cost: 0
  }

  const go = (
    in_: A.Chunk<I>,
    os: A.Chunk<O>,
    state: FoldWeightedState,
    dirty: boolean
  ): T.Effect<R, E, readonly [A.Chunk<O>, FoldWeightedState, boolean]> =>
    A.reduce_(
      in_,
      T.succeed([os, state, dirty]) as T.Effect<
        R,
        E,
        readonly [A.Chunk<O>, FoldWeightedState, boolean]
      >,
      (o, i) =>
        T.chain_(o, ([os, state, _]) =>
          T.chain_(costFn(state.result, i), (cost) => {
            const total = cost + state.cost
            if (total > max) {
              return T.chain_(decompose(i), (is) => {
                if (A.size(is) <= 1 && !dirty) {
                  return T.map_(
                    f(state.result, !A.isEmpty(is) ? A.unsafeGet_(is, 0) : i),
                    (o) => [A.append_(os, o), initialState, false] as const
                  )
                } else if (A.size(is) <= 1 && dirty) {
                  const elem = !A.isEmpty(is) ? A.unsafeGet_(is, 0) : i
                  return T.zipWith_(
                    f(initialState.result, elem),
                    costFn(initialState.result, elem),
                    (result, cost) => [
                      A.append_(os, state.result),
                      { result, cost },
                      true
                    ]
                  )
                } else {
                  return go(is, os, state, dirty)
                }
              })
            } else {
              return T.map_(
                f(state.result, i),
                (o) => [os, { result: o, cost: total }, true] as const
              )
            }
          })
        )
    )

  return new Transducer(
    M.map_(
      R.makeManagedRef(O.some(initialState)),
      (state) => (is: O.Option<A.Chunk<I>>) =>
        O.fold_(
          is,
          () =>
            pipe(
              state,
              R.getAndSet(O.none as O.Option<FoldWeightedState>),
              T.map(
                O.fold(
                  () => A.empty(),
                  (s) => A.single(s.result)
                )
              )
            ),
          (in_) =>
            pipe(
              state.get,
              T.chain((s) =>
                go(
                  in_,
                  A.empty(),
                  O.getOrElse_(s, () => initialState),
                  O.isSome(s)
                )
              ),
              T.chain(([os, s, dirty]) =>
                dirty
                  ? T.zipRight_(state.set(O.some(s)), T.succeed(os))
                  : T.zipRight_(state.set(O.none), T.succeed(os))
              )
            )
        )
    )
  )
}

/**
 * Creates a transducer that folds elements of type `I` into a structure
 * of type `O`, until `max` worth of elements (determined by the `costFn`)
 * have been folded.
 *
 * @note Elements that have an individual cost larger than `max` will
 * force the transducer to cross the `max` cost. See `foldWeightedDecompose`
 * for a variant that can handle these cases.
 */
export function foldWeighted<I, O>(
  initial: O,
  costFn: (o: O, i: I) => number,
  max: number,
  f: (o: O, i: I) => O
): Transducer<unknown, never, I, O> {
  return foldWeightedDecompose(initial, costFn, max, A.single, f)
}

/**
 * Creates a transducer accumulating incoming values into chunks of maximum size `n`.
 */
export function collectAllN<I>(n: number): Transducer<unknown, never, I, A.Chunk<I>> {
  const go = (
    in_: A.Chunk<I>,
    leftover: A.Chunk<I>,
    acc: A.Chunk<A.Chunk<I>>
  ): [A.Chunk<A.Chunk<I>>, A.Chunk<I>] => {
    const [left, nextIn] = A.splitAt_(in_, n - A.size(leftover))
    if (A.size(leftover) + A.size(left) < n) return [acc, A.concat_(leftover, left)]
    else {
      const nextOut = !A.isEmpty(leftover)
        ? A.append_(acc, A.concat_(leftover, left))
        : A.append_(acc, left)
      return go(nextIn, A.empty(), nextOut)
    }
  }

  return new Transducer(
    M.map_(R.makeManagedRef(A.empty<I>()), (state) => (is: O.Option<A.Chunk<I>>) =>
      O.fold_(
        is,
        () =>
          T.map_(R.getAndSet_(state, A.empty()), (leftover) =>
            !A.isEmpty(leftover) ? A.single(leftover) : A.empty()
          ),
        (in_) => R.modify_(state, (leftover) => go(in_, leftover, A.empty()))
      )
    )
  )
}

/**
 * Creates a transducer accumulating incoming values into maps of up to `n` keys. Elements
 * are mapped to keys using the function `key`; elements mapped to the same key will
 * be merged with the function `f`.
 */
export function collectAllToMapN<K, I>(
  n: number,
  key: (i: I) => K,
  merge: (i: I, i1: I) => I
): Transducer<unknown, never, I, ReadonlyMap<K, I>> {
  return pipe(
    foldWeighted<I, ReadonlyMap<K, I>>(
      Map.empty,
      (acc, i) => (acc.has(key(i)) ? 0 : 1),
      n,
      (acc, i) => {
        const k = key(i)
        if (acc.has(k)) return Map.insert(k, merge(acc.get(k) as I, i))(acc)
        else return Map.insert(k, i)(acc)
      }
    ),
    filter(not(Map.isEmpty))
  )
}

/**
 * Accumulates incoming elements into a chunk as long as they verify predicate `p`.
 */
export function collectAllWhile<I>(
  p: Predicate<I>
): Transducer<unknown, never, I, A.Chunk<I>> {
  return pipe(
    fold<I, [A.Chunk<I>, boolean]>(
      [A.empty(), true],
      (t) => t[1],
      ([is, _], i) => (p(i) ? [A.append_(is, i), true] : [is, false])
    ),
    map((t) => t[0]),
    filter((x) => !A.isEmpty(x))
  )
}

/**
 * Accumulates incoming elements into a chunk as long as they verify effectful predicate `p`.
 */
export function collectAllWhileM<R, E, I>(
  p: (i: I) => T.Effect<R, E, boolean>
): Transducer<R, E, I, A.Chunk<I>> {
  return pipe(
    foldM<R, E, I, [A.Chunk<I>, boolean]>(
      [A.empty(), true],
      (t) => t[1],
      ([is, _], i) => T.map_(p(i), (b) => (b ? [A.append_(is, i), true] : [is, false]))
    ),
    map((t) => t[0]),
    filter((x) => !A.isEmpty(x))
  )
}

/**
 * Filters the outputs of this transducer.
 */
export function filter_<R, E, I, O>(
  fa: Transducer<R, E, I, O>,
  predicate: Predicate<O>
): Transducer<R, E, I, O>
export function filter_<R, E, I, O, B extends O>(
  fa: Transducer<R, E, I, O>,
  refinement: Refinement<O, B>
): Transducer<R, E, I, B>
export function filter_<R, E, I, O>(
  fa: Transducer<R, E, I, O>,
  predicate: Predicate<O>
): Transducer<R, E, I, O> {
  return new Transducer(
    M.map_(fa.push, (push) => (is) => T.map_(push(is), A.filter(predicate)))
  )
}

/**
 * Filters the outputs of this transducer.
 */
export function filter<O>(
  predicate: Predicate<O>
): <R, E, I>(fa: Transducer<R, E, I, O>) => Transducer<R, E, I, O>
export function filter<O, B extends O>(
  refinement: Refinement<O, B>
): <R, E, I>(fa: Transducer<R, E, I, O>) => Transducer<R, E, I, B>
export function filter<O>(
  predicate: Predicate<O>
): <R, E, I>(fa: Transducer<R, E, I, O>) => Transducer<R, E, I, O> {
  return (fa) => filter_(fa, predicate)
}

/**
 * Filters the inputs of this transducer.
 */
export function filterInput_<R, E, I, O>(
  fa: Transducer<R, E, I, O>,
  predicate: Predicate<I>
): Transducer<R, E, I, O>
export function filterInput_<R, E, I, O, I1 extends I>(
  fa: Transducer<R, E, I, O>,
  refinement: Refinement<I, I1>
): Transducer<R, E, I1, O>
export function filterInput_<R, E, I, O>(
  fa: Transducer<R, E, I, O>,
  predicate: Predicate<I>
): Transducer<R, E, I, O> {
  return new Transducer(
    M.map_(fa.push, (push) => (is) => push(O.map_(is, A.filter(predicate))))
  )
}

/**
 * Filters the inputs of this transducer.
 */
export function filterInput<I>(
  predicate: Predicate<I>
): <R, E, O>(fa: Transducer<R, E, I, O>) => Transducer<R, E, I, O>
export function filterInput<I, I1 extends I>(
  refinement: Refinement<I, I1>
): <R, E, O>(fa: Transducer<R, E, I, O>) => Transducer<R, E, I1, O>
export function filterInput<I>(
  predicate: Predicate<I>
): <R, E, O>(fa: Transducer<R, E, I, O>) => Transducer<R, E, I, O> {
  return (fa) => filterInput_(fa, predicate)
}

/**
 * Effectually filters the inputs of this transducer.
 */
export function filterInputM_<R, E, I, O, R1, E1>(
  fa: Transducer<R, E, I, O>,
  predicate: (i: I) => T.Effect<R1, E1, boolean>
): Transducer<R & R1, E | E1, I, O> {
  return new Transducer(
    M.map_(fa.push, (push) => (is) =>
      O.fold_(
        is,
        () => push(O.none),
        (x) =>
          pipe(
            x,
            A.filterM(predicate),
            T.chain((in_) => push(O.some(in_)))
          )
      )
    )
  )
}

/**
 * Effectually filters the inputs of this transducer.
 */
export function filterInputM<I, R1, E1>(
  predicate: (i: I) => T.Effect<R1, E1, boolean>
): <R, E, O>(fa: Transducer<R, E, I, O>) => Transducer<R & R1, E | E1, I, O> {
  return (fa) => filterInputM_(fa, predicate)
}
