/*
  based on: https://github.com/rzeigler/waveguide-streams/blob/master/src/stream.ts
  credits to original author
 */

import {
  array as A,
  either as Ei,
  eq as EQ,
  function as F,
  option as O,
  pipeable as P,
  apply as AP,
  tree as TR
} from "fp-ts";
import { ReadStream } from "fs";
import { Writable, Readable } from "stream";
import { Cause, Interrupt } from "../original/exit";
import * as T from "../effect";
import { Fiber, effect } from "../effect";
import * as deferred from "../deferred";
import { Deferred } from "../deferred";
import * as M from "../managed";
import * as cq from "../queue";
import { ConcurrentQueue } from "../queue";
import * as ref from "../ref";
import { Ref } from "../ref";
import * as semaphore from "../semaphore";
import { collectArraySink, drainSink, drainWhileSink, queueSink, Sink, stepMany } from "./sink";
import { isSinkCont, sinkStepLeftover, sinkStepState } from "./step";
import * as su from "./support";
import { Do as DoG } from "fp-ts-contrib/lib/Do";
import { sequenceS as SS, sequenceT as ST } from "fp-ts/lib/Apply";
import { Separated } from "fp-ts/lib/Compactable";
import { Monad4EP } from "../overloadEff";

export type Source<K, R, E, A> = T.Effect<K, R, E, O.Option<A>>;

export type Fold<K, R, E, A> = <S>(
  initial: S,
  cont: F.Predicate<S>,
  step: F.FunctionN<[S, A], T.Effect<K, R, E, S>>
) => T.Effect<K, R, E, S>;

interface StreamT<K, R, E, K2, R2, E2, A> extends M.Managed<K, R, E, Fold<K2, R2, E2, A>> {}

export interface Stream<S, R, E, A> {
  _TAG: () => "Stream";
  _E: () => E;
  _A: () => A;
  _S: () => S;
  _R: (_: R) => void;
}

export type Async<A> = Stream<unknown, unknown, never, A>;
export type AsyncE<E, A> = Stream<unknown, unknown, E, A>;
export type AsyncR<R, A> = Stream<unknown, R, never, A>;
export type AsyncRE<R, E, A> = Stream<unknown, R, E, A>;

export type Sync<A> = Stream<never, unknown, never, A>;
export type SyncE<E, A> = Stream<never, unknown, E, A>;
export type SyncR<R, A> = Stream<never, R, never, A>;
export type SyncRE<R, E, A> = Stream<never, R, E, A>;

const toS = <S, R, E, S2, R2, E2, A>(
  _: StreamT<S, R, E, S2, R2, E2, A>
): Stream<S | S2, R & R2, E | E2, A> => _ as any;
const fromS = <S, R, E, A>(_: Stream<S, R, E, A>): StreamT<S, R, E, S, R, E, A> => _ as any;

// The contract of a Stream's fold is that state is preserved within the lifecycle of the managed
// Therefore, we must track the offset in the array via a ref
// This allows, for instance, this to work with transduce
function arrayFold<A>(
  as: readonly A[]
): M.Sync<Fold<never, unknown, never, A>> {
  return M.encaseEffect(
    effect.map(
      ref.makeRef(0),
      (cell) => <S>(initial: S, cont: F.Predicate<S>, f: F.FunctionN<[S, A], T.Sync<S>>) => {
        function step(current: S): T.Sync<S> {
          /* istanbul ignore else */
          if (cont(current)) {
            return P.pipe(
              cell.modify((i) => [i, i + 1] as const), // increment the i
              T.chain((i) =>
                i < as.length ? effect.chain(f(current, as[i]), step) : T.pure(current)
              )
            );
          } else {
            return T.pure(current);
          }
        }
        return step(initial);
      }
    )
  );
}

function iteratorSource<A>(iter: Iterator<A>): Source<never, unknown, never, A> {
  return T.sync(() => {
    const n = iter.next();
    if (n.done) {
      return O.none;
    }
    return O.some(n.value);
  });
}

function* rangeIterator(start: number, interval?: number, end?: number): Iterator<number> {
  let current = start;
  while (!end || current < end) {
    yield current;
    current += interval || 1;
  }
}

/**
 * Create a Stream from a source A action.
 *
 * The contract is that the acquisition of the resource should produce a Wave that may be repeatedly evaluated
 * during the scope of the Managed
 * If there is more data in the stream, the Wave should produce some(A) otherwise it should produce none.
 * Once it produces none, it will not be evaluated again.
 * @param r
 */
export function fromSource<K, R, E, K2, R2, E2, A>(
  r: M.Managed<K, R, E, T.Effect<K2, R2, E2, O.Option<A>>>
): Stream<K | K2, R & R2, E | E2, A> {
  return toS(
    M.managed.map(r, (pull) => {
      function fold<S>(
        initial: S,
        cont: F.Predicate<S>,
        step: F.FunctionN<[S, A], T.Effect<K2, R2, E2, S>>
      ): T.Effect<K2, R2, E2, S> {
        return cont(initial)
          ? P.pipe(
              pull,
              T.chain((out) =>
                P.pipe(
                  out,
                  O.fold(
                    () => T.pure(initial) as T.Effect<K2, R2, E2, S>,
                    (a) => effect.chain(step(initial, a), (next) => fold(next, cont, step))
                  )
                )
              )
            )
          : T.pure(initial);
      }
      return fold;
    })
  );
}

/**
 * Create a stream from an Array
 * @param as
 */
export function fromArray<A>(as: readonly A[]): Sync<A> {
  return toS(arrayFold(as));
}

/**
 * Create a stream from an iterator
 * @param iter
 */
export function fromIterator<A>(iter: F.Lazy<Iterator<A>>): Sync<A> {
  return P.pipe(M.encaseEffect(T.sync(iter)), M.map(iteratorSource), fromSource);
}

/**
 * Create a stream that emits the elements in a range
 * @param start
 * @param interval
 * @param end
 */
export function fromRange(start: number, interval?: number, end?: number): Sync<number> {
  return fromIterator(() => rangeIterator(start, interval, end));
}

/**
 * Create a stream from an existing iterator
 * @param iter
 */
export function fromIteratorUnsafe<A>(iter: Iterator<A>): Sync<A> {
  return fromIterator(() => iter);
}

/**
 * Create a stream that emits a single element
 * @param a
 */
export function once<A>(a: A): Sync<A> {
  function fold<S>(initial: S, cont: F.Predicate<S>, f: F.FunctionN<[S, A], T.Sync<S>>): T.Sync<S> {
    /* istanbul ignore else */
    if (cont(initial)) {
      return f(initial, a);
    } else {
      return T.pure(initial);
    }
  }
  return toS(M.pure(fold));
}

/**
 * Create a stream that emits As as fast as possible
 *
 * Be cautious when using this. If your entire pipeline is full of synchronous actions you can block the main
 * thread until the stream runs to completion (or forever) using this
 * @param a
 */
export function repeatedly<A>(a: A): Async<A> {
  function fold<S>(
    initial: S,
    cont: F.Predicate<S>,
    f: F.FunctionN<[S, A], T.Async<S>>
  ): T.Async<S> {
    function step(current: S): T.Async<S> {
      if (cont(current)) {
        return T.shiftAfter(effect.chain(f(current, a), step));
      }
      return T.shiftAfter(T.pure(current));
    }
    return step(initial);
  }

  return toS(M.pure(fold));
}

export function periodically(ms: number): Async<number> {
  return P.pipe(
    M.encaseEffect(ref.makeRef(-1)),
    M.map((r) =>
      P.pipe(
        T.delay(
          r.update((n) => n + 1),
          ms
        ),
        T.map(O.some)
      )
    ),
    fromSource
  );
}

/**
 * A stream that emits no elements an immediately terminates
 */
export const empty: Sync<never> = toS(
  M.pure(<S>(initial: S, _cont: F.Predicate<S>, _f: F.FunctionN<[S, never], T.Sync<S>>) =>
    T.pure(initial)
  )
);

/**
 * Create a stream that evalutes w to emit a single element
 * @param w
 */
export function encaseEffect<K, R, E, A>(w: T.Effect<K, R, E, A>): Stream<K, R, E, A> {
  function fold<S>(
    initial: S,
    cont: F.Predicate<S>,
    step: F.FunctionN<[S, A], T.Effect<K, R, E, S>>
  ): T.Effect<K, R, E, S> {
    /* istanbul ignore else */
    if (cont(initial)) {
      return P.pipe(
        w,
        T.chain((a) => step(initial, a))
      );
    } else {
      return T.pure(initial);
    }
  }
  return toS(M.pure(fold));
}

/**
 * Create a stream that immediately fails
 * @param e
 */
export function raised<E>(e: E): SyncE<E, never> {
  return encaseEffect(T.raiseError(e));
}

/**
 * Create a stream that immediately aborts
 * @param e
 */
export function aborted(e: unknown): Sync<never> {
  return encaseEffect(T.raiseAbort(e));
}

/**
 * Create a stream that immediately emits either 0 or 1 elements
 * @param opt
 */
export function fromOption<A>(opt: O.Option<A>): Sync<A> {
  return P.pipe(opt, O.fold(F.constant((empty as any) as Sync<A>), once));
}

/**
 * Zip all stream elements with their index ordinals
 * @param stream
 */
export function zipWithIndex<K, R, E, A>(
  stream: Stream<K, R, E, A>
): Stream<K, R, E, readonly [A, number]> {
  return toS(
    M.managed.map(fromS(stream), (fold) => {
      function zipFold<S>(
        initial: S,
        cont: F.Predicate<S>,
        f: F.FunctionN<[S, readonly [A, number]], T.Effect<K, R, E, S>>
      ): T.Effect<K, R, E, S> {
        const folded = fold<readonly [S, number]>(
          [initial, 0 as number],
          (s) => cont(s[0]),
          ([s, i], a) => effect.map(f(s, [a, i]), (s) => [s, i + 1])
        );
        return effect.map(folded, (s) => s[0]);
      }

      return zipFold;
    })
  );
}

/**
 * Create a stream that emits all the elements of stream1 followed by all the elements of stream2
 * @param stream1
 * @param stream2
 */
function concatL_<K, R, E, A, K2, R2, E2>(
  stream1: Stream<K, R, E, A>,
  stream2: F.Lazy<Stream<K2, R2, E2, A>>
): Stream<K | K2, R & R2, E | E2, A> {
  const w1 = fromS(stream1 as Stream<K | K2, R & R2, E | E2, A>);
  const w2 = () => fromS(stream2() as Stream<K | K2, R & R2, E | E2, A>);

  function fold<S>(
    initial: S,
    cont: F.Predicate<S>,
    step: F.FunctionN<[S, A], T.Effect<K | K2, R & R2, E | E2, S>>
  ): T.Effect<K | K2, R & R2, E | E2, S> {
    return P.pipe(
      M.use(w1, (fold1) => fold1(initial, cont, step)),
      T.chain((intermediate) => {
        /* istanbul ignore else */
        if (cont(intermediate)) {
          return M.use(w2(), (fold2) => fold2(intermediate, cont, step));
        } else {
          return T.pure(intermediate);
        }
      })
    );
  }
  return toS(M.pure(fold));
}

export function concatL<S, A, R2, E2>(
  stream2: F.Lazy<Stream<S, R2, E2, A>>
): <S2, R, E>(s: Stream<S2, R, E, A>) => Stream<S2 | S, R & R2, E | E2, A> {
  return <S2, R, E>(s: Stream<S2, R, E, A>) => concatL_(s, stream2);
}

/**
 * Strict form of concatL
 * @param stream1
 * @param stream2
 */
function concat_<S, R, E, A, S2, R2, E2>(
  stream1: Stream<S, R, E, A>,
  stream2: Stream<S2, R2, E2, A>
): Stream<S | S2, R & R2, E | E2, A> {
  return concatL_(stream1, F.constant(stream2));
}

export function concat<S, A, R2, E2>(
  stream2: Stream<S, R2, E2, A>
): <S2, R, E>(s: Stream<S2, R, E, A>) => Stream<S | S2, R & R2, E2 | E, A> {
  return <S2, R, E>(s: Stream<S2, R, E, A>) => concat_(s, stream2);
}

/**
 * Creates a stream that repeatedly emits the elements of a stream forever.
 *
 * The elements are not cached, any effects required (i.e. opening files or sockets) are repeated for each cycle
 * @param stream
 */
export function repeat<S, R, E, A>(stream: Stream<S, R, E, A>): Stream<S, R, E, A> {
  return concatL_(stream, () => repeat(stream));
}

function map_<K, R, E, A, B>(
  stream: Stream<K, R, E, A>,
  f: F.FunctionN<[A], B>
): Stream<K, R, E, B> {
  return toS(
    M.managed.map(
      fromS(stream),
      (outer) => <S>(
        initial: S,
        cont: F.Predicate<S>,
        step: F.FunctionN<[S, B], T.Effect<K, R, E, S>>
      ): T.Effect<K, R, E, S> => outer(initial, cont, (s, a) => step(s, f(a)))
    )
  );
}

/**
 * Map the elements of a stream
 * @param stream
 * @param f
 */
export function map<R, A, B>(
  f: F.FunctionN<[A], B>
): <S, E>(stream: Stream<S, R, E, A>) => Stream<S, R, E, B> {
  return (stream) => map_(stream, f);
}

/**
 * Map every element emitted by stream to b
 * @param stream
 * @param b
 */
function as_<S, R, E, A, B>(stream: Stream<S, R, E, A>, b: B): Stream<S, R, E, B> {
  return map_(stream, F.constant(b));
}

export function as<B>(b: B): <S, R, E, A>(s: Stream<S, R, E, A>) => Stream<S, R, E, B> {
  return (s) => as_(s, b);
}

/**
 * Filter the elements of a stream by a predicate
 * @param stream
 * @param f
 */
function filter_<K, R, E, A>(stream: Stream<K, R, E, A>, f: F.Predicate<A>): Stream<K, R, E, A> {
  return toS(
    M.managed.map(
      fromS(stream),
      (outer) => <S>(
        initial: S,
        cont: F.Predicate<S>,
        step: F.FunctionN<[S, A], T.Effect<K, R, E, S>>
      ): T.Effect<K, R, E, S> => outer(initial, cont, (s, a) => (f(a) ? step(s, a) : T.pure(s)))
    )
  );
}

export function filter<A, B extends A>(
  f: F.Refinement<A, B>
): <K, R, E>(s: Stream<K, R, E, A>) => Stream<K, R, E, B>;
export function filter<A>(
  f: F.Predicate<A>
): <K, R, E>(s: Stream<K, R, E, A>) => Stream<K, R, E, A>;
export function filter<A>(f: F.Predicate<A>) {
  return <K, R, E>(s: Stream<K, R, E, A>) => filter_(s, f);
}

/**
 * Filter the stream so that only items that are not equal to the previous item emitted are emitted
 * @param eq
 */
function distinctAdjacent_<K, R, E, A>(
  stream: Stream<K, R, E, A>,
  eq: EQ.Eq<A>
): Stream<K, R, E, A> {
  return toS(
    M.managed.map(
      fromS(stream),
      (base) => <S>(
        initial: S,
        cont: F.Predicate<S>,
        step: F.FunctionN<[S, A], T.Effect<K, R, E, S>>
      ): T.Effect<K, R, E, S> => {
        const init: [S, O.Option<A>] = [initial, O.none];
        const c: F.Predicate<[S, O.Option<A>]> = ([s]) => cont(s);
        function stp(current: [S, O.Option<A>], next: A): T.Effect<K, R, E, [S, O.Option<A>]> {
          return P.pipe(
            current[1],
            O.fold(
              // We haven't seen anything so just return
              () => effect.map(step(current[0], next), (s) => [s, O.some(next)]),
              (seen) =>
                eq.equals(seen, next)
                  ? T.pure(current)
                  : effect.map(step(current[0], next), (s) => [s, O.some(next)])
            )
          );
        }
        return effect.map(base(init, c, stp), (s) => s[0]);
      }
    )
  );
}

export function distinctAdjacent<A>(
  eq: EQ.Eq<A>
): <K, R, E>(s: Stream<K, R, E, A>) => Stream<K, R, E, A> {
  return <K, R, E>(s: Stream<K, R, E, A>) => distinctAdjacent_(s, eq);
}

/**
 * Fold the elements of this stream together using an effect.
 *
 * The resulting stream will emit 1 element produced by the effectful fold
 * @param stream
 * @param f
 * @param seed
 */
function foldM_<K, R, E, A, K2, R2, E2, B>(
  stream: Stream<K, R, E, A>,
  f: F.FunctionN<[B, A], T.Effect<K2, R2, E2, B>>,
  seed: B
): Stream<K | K2, R & R2, E | E2, B> {
  return toS(
    M.managed.map(
      fromS(stream as Stream<K | K2, R & R2, E | E2, A>),
      (base) => <S>(
        initial: S,
        cont: F.Predicate<S>,
        step: F.FunctionN<[S, B], T.Effect<K | K2, R & R2, E | E2, S>>
      ): T.Effect<K | K2, R & R2, E | E2, S> => {
        /* istanbul ignore else */
        if (cont(initial)) {
          return effect.chain(base(seed, F.constant(true), f), (result) => step(initial, result));
        } else {
          return T.pure(initial);
        }
      }
    )
  );
}

export function foldM<K, A, R2, E2, B>(
  seed: B,
  f: F.FunctionN<[B, A], T.Effect<K, R2, E2, B>>
): <K2, R, E>(s: Stream<K2, R, E, A>) => Stream<K | K2, R & R2, E2 | E, B> {
  return <K2, R, E>(s: Stream<K2, R, E, A>) => foldM_(s, f, seed);
}

/**
 * Fold the elements of a stream together purely
 * @param stream
 * @param f
 * @param seed
 */
function fold_<S, R, E, A, B>(
  stream: Stream<S, R, E, A>,
  f: F.FunctionN<[B, A], B>,
  seed: B
): Stream<S, R, E, B> {
  return foldM_(stream, (b, a) => T.pure(f(b, a)), seed);
}

function t2<A, B>(a: A, b: B): readonly [A, B] {
  return [a, b];
}

export function fold<A, B>(
  seed: B,
  f: F.FunctionN<[B, A], B>
): <S, R, E>(s: Stream<S, R, E, A>) => Stream<S, R, E, B> {
  return <S, R, E>(s: Stream<S, R, E, A>) => fold_(s, f, seed);
}

/**
 * Scan across the elements the stream.
 *
 * This is like foldM but emits every intermediate seed value in the resulting stream.
 * @param stream
 * @param f
 * @param seed
 */
function scanM_<K, R, E, A, B, K2, R2, E2>(
  stream: Stream<K, R, E, A>,
  f: F.FunctionN<[B, A], T.Effect<K2, R2, E2, B>>,
  seed: B
): Stream<K | K2, R & R2, E | E2, B> {
  return concat_(
    once(seed),
    toS(
      P.pipe(
        M.zip(
          fromS(stream as Stream<K | K2, R & R2, E | E2, A>),
          M.encaseEffect(ref.makeRef(seed))
        ),
        M.map(([base, accum]) => {
          function fold<S>(
            initial: S,
            cont: F.Predicate<S>,
            step: F.FunctionN<[S, B], T.Effect<K | K2, R & R2, E | E2, S>>
          ): T.Effect<K | K2, R & R2, E | E2, S> {
            /* istanbul ignore else */
            if (cont(initial)) {
              // We need to figure out how to drive the base fold for a single step
              // Thus, we switch state from true to false on execution
              return P.pipe(
                accum.get,
                T.chain((b) =>
                  base(
                    t2(b, true),
                    (s) => s[1],
                    (s, a) => effect.map(f(s[0], a), (r) => t2(r, false))
                  )
                ),
                T.chain(
                  // If this is still true, we didn't consume anything so advance
                  (s) =>
                    s[1]
                      ? T.pure(initial)
                      : T.applySecond(
                          accum.set(s[0]),
                          effect.chain(step(initial, s[0]), (next) => fold(next, cont, step))
                        )
                )
              );
            } else {
              return T.pure(initial);
            }
          }
          return fold;
        })
      )
    )
  );
}

export function scanM<S, A, B, R2, E2>(
  seed: B,
  f: F.FunctionN<[B, A], T.Effect<S, R2, E2, B>>
): <S2, R, E>(s: Stream<S2, R, E, A>) => Stream<S2 | S, R & R2, E | E2, B> {
  return <S2, R, E>(s: Stream<S2, R, E, A>) => scanM_(s, f, seed);
}

/**
 * Purely scan a stream
 * @param stream
 * @param f
 * @param seed
 */
function scan_<S, R, E, A, B>(
  stream: Stream<S, R, E, A>,
  f: F.FunctionN<[B, A], B>,
  seed: B
): Stream<S, R, E, B> {
  return scanM_(stream, (b, a) => T.pure(f(b, a)), seed);
}

export function scan<A, B>(
  seed: B,
  f: F.FunctionN<[B, A], B>
): <S, R, E>(s: Stream<S, R, E, A>) => Stream<S, R, E, B> {
  return <S, R, E>(s: Stream<S, R, E, A>) => scan_(s, f, seed);
}

function chain_<K, R, E, A, K2, R2, E2, B>(
  stream: Stream<K, R, E, A>,
  f: F.FunctionN<[A], Stream<K2, R2, E2, B>>
): Stream<K | K2, R & R2, E | E2, B> {
  return toS(
    M.managed.map(
      fromS(stream as Stream<K | K2, R & R2, E | E2, A>),
      (outerfold) => <S>(
        initial: S,
        cont: F.Predicate<S>,
        step: F.FunctionN<[S, B], T.Effect<K | K2, R & R2, E | E2, S>>
      ): T.Effect<K | K2, R & R2, E | E2, S> =>
        outerfold(initial, cont, (s, a) => {
          /* istanbul ignore next */
          if (cont(s)) {
            const inner = f(a) as Stream<K | K2, R & R2, E | E2, B>;
            return M.use(fromS(inner), (innerfold) => innerfold(s, cont, step));
          } else {
            return T.pure(s);
          }
        })
    )
  );
}

/**
 * Monadic chain on a stream
 * @param stream
 * @param f
 */
export function chain<K, A, R2, E2, B>(
  f: F.FunctionN<[A], Stream<K, R2, E2, B>>
): <K2, R, E>(stream: Stream<K | K2, R, E, A>) => Stream<K | K2, R & R2, E | E2, B> {
  return <K2, R, E>(stream: Stream<K2, R, E, A>) =>
    toS(
      M.managed.map(
        fromS(stream as Stream<K | K2, R & R2, E | E2, A>),
        (outerfold) => <S>(
          initial: S,
          cont: F.Predicate<S>,
          step: F.FunctionN<[S, B], T.Effect<K | K2, R & R2, E | E2, S>>
        ): T.Effect<K | K2, R & R2, E | E2, S> =>
          outerfold(initial, cont, (s, a) => {
            /* istanbul ignore next */
            if (cont(s)) {
              const inner = f(a) as Stream<K | K2, R & R2, E | E2, B>;
              return M.use(fromS(inner), (innerfold) => innerfold(s, cont, step));
            } else {
              return T.pure(s);
            }
          })
      )
    );
}

/**
 * Flatten a stream of streams
 * @param stream
 */
export function flatten<S, R, E, S2, R2, E2, A>(
  stream: Stream<S, R, E, Stream<S2, R2, E2, A>>
): Stream<S | S2, R & R2, E | E2, A> {
  return chain_(stream, F.identity);
}

/**
 * Map each element of the stream effectfully
 * @param stream
 * @param f
 */
function mapM_<S, R, E, A, S2, R2, E2, B>(
  stream: Stream<S, R, E, A>,
  f: F.FunctionN<[A], T.Effect<S2, R2, E2, B>>
): Stream<S | S2, R & R2, E | E2, B> {
  return chain_(stream, (a) => encaseEffect(f(a)));
}

export function mapM<S, A, R2, E2, B>(
  f: F.FunctionN<[A], T.Effect<S, R2, E2, B>>
): <S2, R, E>(s: Stream<S2, R, E, A>) => Stream<S | S2, R & R2, E2 | E, B> {
  return <S2, R, E>(s: Stream<S2, R, E, A>) => mapM_(s, f);
}

/**
 * A stream that emits no elements but never terminates.
 */
export const never: Async<never> = mapM_(once(undefined), F.constant(T.never));

type TDuceFused<FoldState, SinkState> = readonly [FoldState, SinkState, boolean];

/**
 * Transduce a stream via a sink.
 *
 * This repeatedly run a sink to completion on the elements of the input stream and emits the result of each run
 * Leftovers from a previous run are fed to the next run
 *
 * @param stream
 * @param sink
 */
function transduce_<K, R, E, A, K2, R2, E2, S, B>(
  stream: Stream<K, R, E, A>,
  sink: Sink<K2, R2, E2, S, A, B>
): Stream<K | K2, R & R2, E | E2, B> {
  return toS(
    M.managed.map(
      fromS(stream as Stream<K | K2, R & R2, E | E2, A>),
      (base) => <S0>(
        initial: S0,
        cont: F.Predicate<S0>,
        step: F.FunctionN<[S0, B], T.Effect<K | K2, R & R2, E | E2, S0>>
      ): T.Effect<K | K2, R & R2, E | E2, S0> => {
        function feedSink(
          foldState: S0,
          sinkState: S,
          chunk: A[]
        ): T.Effect<K | K2, R & R2, E | E2, TDuceFused<S0, S>> {
          return effect.chain(stepMany(sink, sinkState, chunk), (nextSinkStep) =>
            isSinkCont(nextSinkStep)
              ? // We need to let more data in to drive the sink
                T.pure([foldState, nextSinkStep.state, true] as const)
              : // We have a completion, so extract the value and then use it to advance the fold state
                P.pipe(
                  sinkStepState(nextSinkStep),
                  sink.extract,
                  T.chain((b) => step(foldState, b)),
                  T.chain((nextFoldState) => {
                    const leftover = sinkStepLeftover(nextSinkStep);
                    // We will re-initialize the sink
                    return P.pipe(
                      sink.initial,
                      T.chain((nextNextSinkState) => {
                        if (cont(nextFoldState) && leftover.length > 0) {
                          return feedSink(nextFoldState, nextNextSinkState.state, leftover as A[]);
                        } else {
                          return T.pure([
                            nextFoldState,
                            nextNextSinkState.state,
                            false as boolean
                          ] as const);
                        }
                      })
                    );
                  })
                )
          );
        }

        const derivedInitial = effect.map(
          sink.initial,
          (initSink) => [initial, sinkStepState(initSink), false] as TDuceFused<S0, S>
        );

        return P.pipe(
          derivedInitial,
          T.chain((init) =>
            base(
              init,
              (s) => cont(s[0]),
              (s, a) => feedSink(s[0], s[1], [a])
            )
          ),
          T.chain(([foldState, sinkState, extract]) =>
            extract && cont(foldState)
              ? effect.chain(sink.extract(sinkState), (b) => step(foldState, b))
              : T.pure(foldState)
          )
        );
      }
    )
  );
}

export function transduce<K, A, R2, E2, S, B>(
  sink: Sink<K, R2, E2, S, A, B>
): <K2, R, E>(s: Stream<K2, R, E, A>) => Stream<K2 | K, R & R2, E | E2, B> {
  return <K2, R, E>(s: Stream<K2, R, E, A>) => transduce_(s, sink);
}

/**
 * Drop some number of elements from a stream
 *
 * Their effects to be produced still occur in the background
 * @param stream
 * @param n
 */
function drop_<K, R, E, A>(stream: Stream<K, R, E, A>, n: number): Stream<K, R, E, A> {
  return P.pipe(
    zipWithIndex(stream),
    filter(([_, i]) => i >= n),
    map(([a]) => a)
  );
}

export function drop(n: number): <K, R, E, A>(s: Stream<K, R, E, A>) => Stream<K, R, E, A> {
  return <K, R, E, A>(s: Stream<K, R, E, A>) => drop_(s, n);
}

/**
 * Take some number of elements of a stream
 * @param stream
 * @param n
 */
function take_<K, R, E, A>(stream: Stream<K, R, E, A>, n: number): Stream<K, R, E, A> {
  return toS(
    M.managed.map(
      fromS(stream),
      (fold) => <S>(
        initial: S,
        cont: F.Predicate<S>,
        step: F.FunctionN<[S, A], T.Effect<K, R, E, S>>
      ): T.Effect<K, R, E, S> =>
        effect.map(
          fold(
            t2(initial, 0),
            (t2s) => t2s[1] < n && cont(t2s[0]),
            (s, a) => effect.map(step(s[0], a), (next) => t2(next, s[1] + 1))
          ),
          (t2s) => t2s[0]
        )
    )
  );
}

export function take(n: number): <K, R, E, A>(s: Stream<K, R, E, A>) => Stream<K, R, E, A> {
  return <K, R, E, A>(s: Stream<K, R, E, A>) => take_(s, n);
}

/**
 * Take elements of a stream while a predicate holds
 * @param stream
 * @param pred
 */
function takeWhile_<K, R, E, A>(
  stream: Stream<K, R, E, A>,
  pred: F.Predicate<A>
): Stream<K, R, E, A> {
  return toS(
    M.managed.map(
      fromS(stream),
      (fold) => <S>(
        initial: S,
        cont: F.Predicate<S>,
        step: F.FunctionN<[S, A], T.Effect<K, R, E, S>>
      ): T.Effect<K, R, E, S> =>
        effect.map(
          fold(
            t2(initial, true),
            (t2s) => t2s[1] && cont(t2s[0]),
            (s, a) =>
              pred(a)
                ? effect.map(step(s[0], a), (next) => t2(next, true))
                : T.pure(t2(s[0], false))
          ),
          (t2s) => t2s[0]
        )
    )
  );
}

export function takeWhile<A>(
  pred: F.Predicate<A>
): <K, R, E>(s: Stream<K, R, E, A>) => Stream<K, R, E, A> {
  return <K, R, E>(s: Stream<K, R, E, A>) => takeWhile_(s, pred);
}

/**
 * Take elements from a stream until a given effect resolves.
 *
 * @param until The effect that will terminate the stream
 * @param stream The stream
 */
function takeUntil_<K, R1, E1, K2, R2, E2, A>(
  stream: Stream<K, R1, E1, A>,
  until: T.Effect<K2, R2, E2, any>
) {
  type Wrapped = { type: "until" } | { type: "stream"; value: A };
  type WrappedStream = Extract<Wrapped, { type: "stream" }>;

  const wrappedUntil: Stream<K2, R1 & R2, E1 | E2, Wrapped> = as<Wrapped>({ type: "until" })(
    encaseEffect(until)
  );

  const wrappedStream: Stream<K, R1 & R2, E1 | E2, Wrapped> = P.pipe(
    stream,
    map((value): Wrapped => ({ type: "stream", value }))
  );

  return P.pipe(
    mergeAll([wrappedUntil, wrappedStream]),
    takeWhile((wrapped) => wrapped.type === "stream"),
    filter((wrapped): wrapped is WrappedStream => wrapped.type === "stream"),
    map((wrapped) => wrapped.value)
  );
}

export function takeUntil<K, R2, E2>(
  until: T.Effect<K, R2, E2, any>
): <K2, R1, E1, A>(s: Stream<K2, R1 & R2, E1 | E2, A>) => AsyncRE<R1 & R2, E1 | E2, A> {
  return <K2, R1, E1, A>(s: Stream<K2, R1 & R2, E1 | E2, A>) => takeUntil_(s, until);
}

/**
 * Push a stream into a sink to produce the sink's result
 * @param stream
 * @param sink
 */
function into_<K, R, E, A, K2, R2, E2, S, B>(
  stream: Stream<K, R, E, A>,
  sink: Sink<K2, R2, E2, S, A, B>
): T.Effect<K | K2, R & R2, E | E2, B> {
  return M.use(fromS(stream as Stream<K | K2, R & R2, E | E2, A>), (fold) =>
    P.pipe(
      sink.initial,
      T.chain((init) => fold(init, isSinkCont, (s, a) => sink.step(s.state, a))),
      T.map((s) => s.state),
      T.chain(sink.extract)
    )
  );
}

export function into<K, A, R2, E2, S, B>(
  sink: Sink<K, R2, E2, S, A, B>
): <K2, R, E>(s: Stream<K2, R, E, A>) => T.Effect<K2 | K, R & R2, E | E2, B> {
  return <K2, R, E>(s: Stream<K2, R, E, A>) => into_(s, sink);
}

/**
 * Push a stream into a sink to produce the sink's result
 * @param stream
 * @param managedSink
 */
function intoManaged_<K, R, E, A, S, B, K2, R2, E2, K3, R3, E3>(
  stream: Stream<K, R, E, A>,
  managedSink: M.Managed<K2, R2, E2, Sink<K3, R3, E3, S, A, B>>
): T.Effect<K | K2 | K3, R & R2 & R3, E | E2 | E3, B> {
  return M.use(managedSink, (sink) => into_(stream, sink));
}

export function intoManaged<K2, R2, E2, K3, R3, E3, A, S, B>(
  managedSink: M.Managed<K2, R2, E2, Sink<K3, R3, E3, S, A, B>>
): <K, R, E>(s: Stream<K, R, E, A>) => T.Effect<K | K2 | K3, R & R2 & R3, E | E2 | E3, B> {
  return <K, R, E>(s: Stream<K, R, E, A>) => intoManaged_(s, managedSink);
}

/**
 * Push a stream in a sink to produce the result and the leftover
 * @param stream
 * @param sink
 */
function intoLeftover_<K, R, E, A, S, B, K2, R2, E2>(
  stream: Stream<K, R, E, A>,
  sink: Sink<K2, R2, E2, S, A, B>
): T.Effect<K | K2, R & R2, E | E2, readonly [B, readonly A[]]> {
  return M.use((stream as any) as StreamT<K, R, E, K2, R2, E2, A>, (fold) =>
    P.pipe(
      sink.initial,
      T.chain((init) => fold(init, isSinkCont, (s, a) => sink.step(s.state, a))),
      T.chain((end) =>
        effect.map(sink.extract(end.state), (b) => [b, sinkStepLeftover(end)] as const)
      )
    )
  );
}

export function intoLeftover<A, S, B, K2, R2, E2>(
  sink: Sink<K2, R2, E2, S, A, B>
): <K, R, E>(
  s: Stream<K, R, E, A>
) => T.Effect<K2 | K, R & R2, E2 | E, readonly [B, readonly A[]]> {
  return <K, R, E>(s: Stream<K, R, E, A>) => intoLeftover_(s, sink);
}

function sinkQueue<S, R, E, A>(
  stream: Stream<S, R, E, A>
): M.Managed<
  unknown,
  R,
  E,
  readonly [ConcurrentQueue<O.Option<A>>, Deferred<unknown, R, E, O.Option<A>>]
> {
  return M.managed.chain(
    M.zip(
      // 0 allows maximum backpressure throttling (i.e. a reader must be waiting already to produce the item)
      M.encaseEffect(cq.boundedQueue<O.Option<A>>(0)),
      M.encaseEffect(deferred.makeDeferred<unknown, R, E, O.Option<A>, E>())
    ),
    ([q, latch]) => {
      const write = effect.foldExit(
        into_(map_(stream, O.some), queueSink(q)) as T.AsyncRE<R, E, void>,
        (c) => latch.cause(c),
        F.constant(q.offer(O.none))
      );

      return M.as(M.fiber(write), [q, latch] as const);
    }
  );
}

/**
 * Zip two streams together termitating when either stream is exhausted
 * @param as
 * @param bs
 * @param f
 */
function zipWith_<S, R, E, A, S2, R2, E2, B, C>(
  as: Stream<S, R, E, A>,
  bs: Stream<S2, R2, E2, B>,
  f: F.FunctionN<[A, B], C>
): AsyncRE<R & R2, E | E2, C> {
  const source = M.zipWith(sinkQueue(as), sinkQueue(bs), ([aq, alatch], [bq, blatch]) => {
    const atake = P.pipe(
      aq.take,
      T.chainTap((opt) =>
        P.pipe(
          opt,
          O.fold(
            // Confirm we have seen the last element
            () => alatch.done(O.none),
            () => T.unit // just keep going
          )
        )
      )
    );
    const agrab = T.raceFirst(atake, alatch.wait);
    const btake = P.pipe(
      bq.take,
      T.chainTap((opt) =>
        P.pipe(
          opt,
          O.fold(
            // Confirm we have seen the last element
            () => blatch.done(O.none),
            () => T.unit // just keep going
          )
        )
      )
    );
    const bgrab = T.raceFirst(btake, blatch.wait);

    return T.effect.zipWith(agrab, bgrab, (aOpt, bOpt) =>
      O.option.chain(aOpt, (a) => O.option.map(bOpt, (b) => f(a, b)))
    );
  });

  return fromSource(source);
}

export function zipWith<A, S2, R2, E2, B, C>(
  bs: Stream<S2, R2, E2, B>,
  f: F.FunctionN<[A, B], C>
): <S, R, E>(s: Stream<S, R, E, A>) => AsyncRE<R & R2, E | E2, C> {
  return <S, R, E>(s: Stream<S, R, E, A>) => zipWith_(s, bs, f);
}

/**
 * zipWith to form tuples
 * @param as
 * @param bs
 */
function zip_<S, R, E, A, S2, R2, E2, B>(
  as: Stream<S, R, E, A>,
  bs: Stream<S2, R2, E2, B>
): AsyncRE<R & R2, E | E2, readonly [A, B]> {
  return zipWith_(as, bs, (a, b) => [a, b] as const);
}

export function zip<S2, R2, E2, B>(bs: Stream<S2, R2, E2, B>) {
  return <S, R, E, A>(as: Stream<S, R, E, A>) => zip_(bs, as);
}

/**
 * Given a queue and a Deferred for signalling exits construct a Wave of a pull operation.
 * The protocol is that errors are propogated through the latch and the latch can be used to track completion.
 * Once a none is received through the queue, this read process completes the latch with none to to make the finish durable
 * in the face of repeated reads (which is important for peel)
 *
 * @param queue
 * @param breaker
 */
function queueBreakerSource<R, E, A>(
  queue: ConcurrentQueue<O.Option<A>>,
  breaker: Deferred<unknown, R, E, O.Option<A>>
): T.AsyncRE<R, E, O.Option<A>> {
  const take = P.pipe(
    queue.take,
    T.chainTap((opt) =>
      P.pipe(
        opt,
        O.fold(
          // Confirm we have seen the last element by closing the breaker so subsequent reads see it
          F.constant(breaker.done(O.none)),
          // do nothing to the breaker if we got an element
          F.constant(T.unit)
        )
      )
    )
  );
  return T.raceFirst(take, breaker.wait);
}

/**
 * Construct a Source for a Stream.
 * During the scope of the Managed, Wave will repeatedly pull items from a queue being managed in the background
 * @param stream
 */
function streamQueueSource<S, R, E, A>(
  stream: Stream<S, R, E, A>
): M.AsyncRE<R, E, T.AsyncRE<R, E, O.Option<A>>> {
  return M.managed.map(sinkQueue(stream), ([q, breaker]) => queueBreakerSource(q, breaker));
}

/**
 * Feed a stream into a sink to produce a value.
 *
 * Emits the value and a 'remainder' stream that includes the rest of the elements of the input stream.
 * @param stream
 * @param sink
 */
function peel_<K, R, E, A, S, B, K2, R2, E2>(
  stream: Stream<K, R, E, A>,
  sink: Sink<K2, R2, E2, S, A, B>
): AsyncRE<R & R2, E | E2, readonly [B, AsyncRE<R & R2, E | E2, A>]> {
  return toS(
    M.managed.chain(streamQueueSource(stream), (pull) => {
      const pullStream = fromSource(M.pure(pull));
      // We now have a shared pull instantiation that we can use as a sink to drive and return as a stream
      return fromS(
        P.pipe(
          encaseEffect(intoLeftover_(pullStream, sink)),
          map(([b, left]) => [b, concat_(fromArray(left), pullStream)] as const)
        )
      );
    })
  );
}

export function peel<K, A, S, B, R2, E2>(sink: Sink<K, R2, E2, S, A, B>) {
  return <K2, R, E>(s: Stream<K2, R, E, A>) => peel_(s, sink);
}

function peelManaged_<K, R, E, A, S, B, R2, E2, K2, K3, R3, E3>(
  stream: Stream<K, R, E, A>,
  managedSink: M.Managed<K2, R2, E2, Sink<K3, R3, E3, S, A, B>>
): Stream<unknown, R & R2 & R3, E | E2 | E3, readonly [B, AsyncRE<R & R2 & R3, E | E2 | E3, A>]> {
  return toS(M.managed.chain(managedSink, (sink) => fromS(peel_(stream, sink))));
}

export function peelManaged<A, S, B, K2, R2, E2, K3, R3, E3>(
  managedSink: M.Managed<K2, R2, E2, Sink<K3, R3, E3, S, A, B>>
) {
  return <K, R, E>(s: Stream<K, R, E, A>) => peelManaged_(s, managedSink);
}

function interruptFiberSlot(slot: Ref<O.Option<Fiber<never, void>>>): T.Async<O.Option<Interrupt>> {
  return effect.chain(slot.get, (optFiber) =>
    P.pipe(
      optFiber,
      O.fold(
        () => T.pure(O.none),
        (f) => T.effect.map(f.interrupt, O.some)
      )
    )
  );
}

function waitFiberSlot(slot: Ref<O.Option<Fiber<never, void>>>): T.Async<void> {
  return effect.chain(slot.get, (optFiber) =>
    P.pipe(
      optFiber,
      O.fold(
        () => T.pure(undefined as void),
        (f) => T.asUnit(f.wait)
      )
    )
  );
}

function singleFiberSlot(): M.Async<Ref<O.Option<Fiber<never, void>>>> {
  return M.bracket(ref.makeRef<O.Option<Fiber<never, void>>>(O.none), interruptFiberSlot);
}

/**
 * Create a stream that switches to emitting elements of the most recent input stream.
 * @param stream
 */
export function switchLatest<R, E, A, R2, E2>(
  stream: AsyncRE<R, E, AsyncRE<R2, E2, A>>
): AsyncRE<R & R2, E | E2, A> {
  const source = M.managed.chain(streamQueueSource(stream), (
    pull // read streams
  ) =>
    M.managed.chain(
      M.zip(
        // The queue and latch to push into
        M.encaseEffect(cq.boundedQueue<O.Option<A>>(0)),
        M.encaseEffect(deferred.makeDeferred<unknown, R, E, O.Option<A>, E>())
      ),
      ([pushQueue, pushBreaker]) =>
        // The internal latch that can be used to signal failures and shut down the read process
        M.managed.chain(
          M.encaseEffect(deferred.makeDeferred<unknown, unknown, never, Cause<E>, E>()),
          (internalBreaker) =>
            // somewhere to hold the currently running fiber so we can interrupt it on termination
            M.managed.chain(singleFiberSlot(), (fiberSlot) => {
              const interruptPushFiber = interruptFiberSlot(fiberSlot);
              // Spawn a fiber that should push elements from stream into pushQueue as long as it is able
              function spawnPushFiber(
                stream: AsyncRE<R & R2, E | E2, A>
              ): T.AsyncRE<R & R2, never, O.Option<Interrupt>> {
                const writer = P.pipe(
                  // The writer process pushes things into the queue
                  into_(map_(stream, O.some), queueSink(pushQueue)) as any,
                  // We need to trap any errors that occur and send those to internal latch to halt the process
                  // Dont' worry about interrupts, because we perform cleanups for single fiber slot
                  T.foldExit(
                    (e: Cause<E>) => internalBreaker.done(e),
                    F.constant(T.pure(undefined)) // we can do nothing because we will delegate to the proxy
                  )
                );

                return T.applyFirst(
                  interruptPushFiber,
                  effect.chain(T.fork(writer), (f) => fiberSlot.set(O.some(f)))
                );
              }

              // pull streams and setup the push fibers appropriately
              function advanceStreams(): T.AsyncRE<R & R2, never, void> {
                // We need a way of looking ahead to see errors in the output streams in order to cause termination
                // The push fiber will generate this when it encounters a failure
                const breakerError = effect.chain(internalBreaker.wait, T.raised);

                return effect.foldExit(
                  T.raceFirst(pull, breakerError),
                  // In the event of an error either from pull or from upstream we need to shut everything down
                  // On managed unwind the active production fiber will be interrupted if there is one
                  (cause) => pushBreaker.cause(cause),
                  (nextOpt) =>
                    P.pipe(
                      nextOpt,
                      O.fold(
                        // nothing left, so we should wait the push fiber's completion and then forward the termination
                        () =>
                          P.pipe(
                            T.race(breakerError, waitFiberSlot(fiberSlot)),
                            T.foldExit(
                              (c) => pushBreaker.cause(c), // if we get a latchError forward it through to downstream
                              F.constant(pushQueue.offer(O.none)) // otherwise we are done, so lets forward that
                            )
                          ),
                        (next) => T.applySecondL(spawnPushFiber(next), advanceStreams)
                      )
                    )
                );
              }
              // We can configure this source now, but it will be invalid outside of running fibers
              // Thus we can use managed.fiber
              const downstreamSource = queueBreakerSource(pushQueue, pushBreaker);
              return M.as(M.fiber(advanceStreams()), downstreamSource);
            })
        )
    )
  );
  return fromSource(source);
}

/**
 * Create a stream that switches to emitting the elements of the most recent stream produced by applying f to the
 * element most recently emitted
 * @param stream
 * @param f
 */

/* istanbul ignore next */
function chainSwitchLatest_<S, R, E, A, S2, R2, E2, B>(
  stream: Stream<S, R, E, A>,
  f: F.FunctionN<[A], Stream<S2, R2, E2, B>>
): AsyncRE<R & R2, E | E2, B> {
  return switchLatest(map_(stream, f));
}

/* istanbul ignore next */
export function chainSwitchLatest<A, S2, R2, E2, B>(
  f: F.FunctionN<[A], Stream<S2, R2, E2, B>>
): <S, R, E>(s: Stream<S, R, E, A>) => AsyncRE<R & R2, E2 | E, B> {
  return <S, R, E>(s: Stream<S, R, E, A>) => chainSwitchLatest_(s, f);
}

interface Weave {
  attach<S, R>(action: T.Effect<S, R, never, void>): T.Effect<S, R, never, void>;
}

type WeaveHandle = readonly [number, Fiber<never, void>];

function interruptWeaveHandles(ref: Ref<WeaveHandle[]>): T.Async<void> {
  return effect.chain(ref.get, (fibers) =>
    T.asUnit(A.array.traverse(T.effect)(fibers, (fiber) => fiber[1].interrupt))
  );
}

// Track many fibers for the purpose of clean interruption on failure
const makeWeave: M.Async<Weave> = M.managed.chain(
  M.encaseEffect(ref.makeRef(0)),
  (cell) =>
    // On cleanup we want to interrupt any running fibers
    M.managed.map(M.bracket(ref.makeRef<WeaveHandle[]>([]), interruptWeaveHandles), (store) => {
      function attach(action: T.Sync<void>): T.Sync<void> {
        return P.pipe(
          AP.sequenceS(T.effect)({
            next: cell.update((n) => n + 1),
            fiber: T.fork(action)
          }),
          T.chainTap(({ next, fiber }) =>
            store.update((handles) => [...handles, [next, fiber] as const])
          ),
          T.chainTap(({ next, fiber }) =>
            T.fork(T.applySecond(fiber.wait, store.update(A.filter((h) => h[0] !== next))))
          ),
          T.asUnit
        );
      }
      return { attach };
    })
);

/**
 * Merge a stream of streams into a single stream.
 *
 * This stream will run up to maxActive streams concurrently to produce values into the output stream.
 * @param stream the input stream
 * @param maxActive the maximum number of streams to hold active at any given time
 * this controls how much active streams are able to collectively produce in the face of a slow downstream consumer
 */
function merge_<K, R, E, A, K2, R2, E2>(
  stream: Stream<K, R, E, Stream<K2, R2, E2, A>>,
  maxActive: number
): AsyncRE<R & R2, E | E2, A> {
  const source = M.managed.chain(streamQueueSource(stream), (pull) =>
    M.managed.chain(M.encaseEffect(semaphore.makeSemaphore(maxActive)), (sem) =>
      // create the queue that output will be forced into
      M.managed.chain(M.encaseEffect(cq.boundedQueue<O.Option<A>>(0)), (pushQueue) =>
        // create the mechanism t hrough which we can signal completion
        M.managed.chain(
          M.encaseEffect(deferred.makeDeferred<unknown, R & R2, E | E2, O.Option<A>, E | E2>()),
          (pushBreaker) =>
            M.managed.chain(makeWeave, (weave) =>
              M.managed.chain(
                M.encaseEffect(
                  deferred.makeDeferred<unknown, unknown, never, Cause<E | E2>, E | E2>()
                ),
                (internalBreaker) => {
                  // create a wave action that will proxy elements created by running the stream into the push queue
                  // if any errors occur, we set the breaker
                  function spawnPushFiber(
                    stream: Stream<K2, R2, E2, A>
                  ): T.AsyncRE<R2, never, void> {
                    const writer = P.pipe(
                      // Process to sink elements into the queue
                      into_(map_(stream, O.some), queueSink(pushQueue)) as any,
                      // TODO: I don't think we need to handle interrupts, it shouldn't be possible
                      T.foldExit(
                        (e: Cause<E>) => internalBreaker.done(e),
                        F.constant(T.pure(undefined))
                      )
                    );
                    return weave.attach(sem.withPermit(writer)); // we need a permit to start
                  }

                  // The action that will pull a single stream upstream and attempt to activate it to push downstream
                  function advanceStreams(): T.AsyncRE<R & R2, never, void> {
                    const breakerError = effect.chain(internalBreaker.wait, T.raised);

                    return effect.foldExit(
                      T.raceFirst(
                        pull, // we don't want to pull until there is capacity
                        breakerError
                      ),
                      (c) => pushBreaker.cause(c), // if upstream errored, we should push the failure downstream immediately
                      (
                        nextOpt // otherwise we should
                      ) =>
                        P.pipe(
                          nextOpt,
                          O.fold(
                            // The end has occured
                            F.constant(
                              P.pipe(
                                // We will wait for an error or all active produces to finish
                                T.race(breakerError, sem.acquireN(maxActive)),
                                T.foldExit(
                                  (c) => pushBreaker.cause(c),
                                  F.constant(pushQueue.offer(O.none))
                                )
                              )
                            ),
                            // Start the push fiber and then keep going
                            (next) =>
                              T.applySecondL(
                                sem.withPermit(spawnPushFiber(next)),
                                F.constant(advanceStreams())
                              )
                          )
                        )
                    );
                  }
                  const downstreamSource = queueBreakerSource(pushQueue, pushBreaker);
                  return M.as(M.fiber(advanceStreams()), downstreamSource);
                }
              )
            )
        )
      )
    )
  );
  return fromSource(source);
}

export function merge(
  maxActive: number
): <K, R, E, A, K2, R2, E2>(
  stream: Stream<K, R, E, Stream<K2, R2, E2, A>>
) => AsyncRE<R & R2, E | E2, A> {
  return <K, R, E, A, K2, R2, E2>(stream: Stream<K, R, E, Stream<K2, R2, E2, A>>) =>
    merge_(stream, maxActive);
}

function chainMerge_<S, R, E, A, B, S2, R2, E2>(
  stream: Stream<S, R, E, A>,
  f: F.FunctionN<[A], Stream<S2, R2, E2, B>>,
  maxActive: number
): AsyncRE<R & R2, E | E2, B> {
  return merge_(map_(stream, f), maxActive);
}

export function chainMerge<K, A, B, R2, E2>(
  maxActive: number,
  f: F.FunctionN<[A], Stream<K, R2, E2, B>>
) {
  return <K2, R, E>(s: Stream<K2, R, E, A>) => chainMerge_(s, f, maxActive);
}

export function mergeAll<R, E, A>(streams: Array<AsyncRE<R, E, A>>): AsyncRE<R, E, A> {
  return merge_((fromArray(streams) as any) as AsyncRE<R, E, AsyncRE<R, E, A>>, streams.length);
}

/**
 * Drop elements of the stream while a predicate holds
 * @param stream
 * @param pred
 */
function dropWhile_<S, R, E, A>(
  stream: Stream<S, R, E, A>,
  pred: F.Predicate<A>
): AsyncRE<R, E, A> {
  return chain_(peel_(stream, drainWhileSink(pred)), ([head, rest]) =>
    concat_((fromOption(head) as any) as Stream<S, R, E, A>, rest)
  );
}

export function dropWhile<A>(
  pred: F.Predicate<A>
): <K, R, E>(s: Stream<K, R, E, A>) => AsyncRE<R, E, A> {
  return <K, R, E>(s: Stream<K, R, E, A>) => dropWhile_(s, pred);
}

/**
 * Collect all the elements emitted by a stream into an array.
 * @param stream
 */
export function collectArray<K, R, E, A>(stream: Stream<K, R, E, A>): T.Effect<K, R, E, A[]> {
  return into_(stream, collectArraySink());
}

/**
 * Evaluate a stream for its effects
 * @param stream
 */
export function drain<K, R, E, A>(stream: Stream<K, R, E, A>): T.Effect<K, R, E, void> {
  return into_(stream, drainSink());
}

export const URI = "matechs/Stream";
export type URI = typeof URI;
declare module "fp-ts/lib/HKT" {
  interface URItoKind4<S, R, E, A> {
    [URI]: Stream<S, R, E, A>;
  }
}

export interface StreamF {
  as<S, R, E, A, B>(stream: Stream<S, R, E, A>, b: B): Stream<S, R, E, B>;
  chainMerge<S, R, E, A, B, S2, R2, E2>(
    stream: Stream<S, R, E, A>,
    f: F.FunctionN<[A], Stream<S2, R2, E2, B>>,
    maxActive: number
  ): AsyncRE<R & R2, E | E2, B>;
  chainSwitchLatest<S, R, E, A, S2, R2, E2, B>(
    stream: Stream<S, R, E, A>,
    f: F.FunctionN<[A], Stream<S2, R2, E2, B>>
  ): AsyncRE<R & R2, E | E2, B>;
  concat<S, R, E, A, S2, R2, E2>(
    stream1: Stream<S, R, E, A>,
    stream2: Stream<S2, R2, E2, A>
  ): Stream<S | S2, R & R2, E | E2, A>;
  concatL<K, R, E, A, K2, R2, E2>(
    stream1: Stream<K, R, E, A>,
    stream2: F.Lazy<Stream<K2, R2, E2, A>>
  ): Stream<K | K2, R & R2, E | E2, A>;
  distinctAdjacent<K, R, E, A>(stream: Stream<K, R, E, A>, eq: EQ.Eq<A>): Stream<K, R, E, A>;
  drop<K, R, E, A>(stream: Stream<K, R, E, A>, n: number): Stream<K, R, E, A>;
  dropWhile<S, R, E, A>(stream: Stream<S, R, E, A>, pred: F.Predicate<A>): AsyncRE<R, E, A>;
  filter<K, R, E, A>(stream: Stream<K, R, E, A>, f: F.Predicate<A>): Stream<K, R, E, A>;
  fold<S, R, E, A, B>(
    stream: Stream<S, R, E, A>,
    f: F.FunctionN<[B, A], B>,
    seed: B
  ): Stream<S, R, E, B>;
  foldM<K, R, E, A, K2, R2, E2, B>(
    stream: Stream<K, R, E, A>,
    f: F.FunctionN<[B, A], T.Effect<K2, R2, E2, B>>,
    seed: B
  ): Stream<K | K2, R & R2, E | E2, B>;
  into<K, R, E, A, K2, R2, E2, S, B>(
    stream: Stream<K, R, E, A>,
    sink: Sink<K2, R2, E2, S, A, B>
  ): T.Effect<K | K2, R & R2, E | E2, B>;
  intoLeftover<K, R, E, A, S, B, K2, R2, E2>(
    stream: Stream<K, R, E, A>,
    sink: Sink<K2, R2, E2, S, A, B>
  ): T.Effect<K | K2, R & R2, E | E2, readonly [B, readonly A[]]>;
  intoManaged<K, R, E, A, S, B, K2, R2, E2, K3, R3, E3>(
    stream: Stream<K, R, E, A>,
    managedSink: M.Managed<K2, R2, E2, Sink<K3, R3, E3, S, A, B>>
  ): T.Effect<K | K2 | K3, R & R2 & R3, E | E2 | E3, B>;
  mapM<S, R, E, A, S2, R2, E2, B>(
    stream: Stream<S, R, E, A>,
    f: F.FunctionN<[A], T.Effect<S2, R2, E2, B>>
  ): Stream<S | S2, R & R2, E | E2, B>;
  merge<K, R, E, A, K2, R2, E2>(
    stream: Stream<K, R, E, Stream<K2, R2, E2, A>>,
    maxActive: number
  ): AsyncRE<R & R2, E | E2, A>;
  peel<K, R, E, A, S, B, K2, R2, E2>(
    stream: Stream<K, R, E, A>,
    sink: Sink<K2, R2, E2, S, A, B>
  ): AsyncRE<R & R2, E | E2, readonly [B, AsyncRE<R & R2, E | E2, A>]>;
  peelManaged<K, R, E, A, S, B, R2, E2, K2, K3, R3, E3>(
    stream: Stream<K, R, E, A>,
    managedSink: M.Managed<K2, R2, E2, Sink<K3, R3, E3, S, A, B>>
  ): Stream<unknown, R & R2 & R3, E | E2 | E3, readonly [B, AsyncRE<R & R2 & R3, E | E2 | E3, A>]>;
  scan<S, R, E, A, B>(
    stream: Stream<S, R, E, A>,
    f: F.FunctionN<[B, A], B>,
    seed: B
  ): Stream<S, R, E, B>;
  scanM<K, R, E, A, B, K2, R2, E2>(
    stream: Stream<K, R, E, A>,
    f: F.FunctionN<[B, A], T.Effect<K2, R2, E2, B>>,
    seed: B
  ): Stream<K | K2, R & R2, E | E2, B>;
  take<K, R, E, A>(stream: Stream<K, R, E, A>, n: number): Stream<K, R, E, A>;
  takeWhile<K, R, E, A>(stream: Stream<K, R, E, A>, pred: F.Predicate<A>): Stream<K, R, E, A>;
  transduce<K, R, E, A, K2, R2, E2, S, B>(
    stream: Stream<K, R, E, A>,
    sink: Sink<K2, R2, E2, S, A, B>
  ): Stream<K | K2, R & R2, E | E2, B>;
  takeUntil<K, R1, E1, K2, R2, E2, A>(
    stream: Stream<K, R1, E1, A>,
    until: T.Effect<K2, R2, E2, any>
  ): AsyncRE<R1 & R2, E1 | E2, A>;
  zip<S, R, E, A, S2, R2, E2, B>(
    as: Stream<S, R, E, A>,
    bs: Stream<S2, R2, E2, B>
  ): AsyncRE<R & R2, E | E2, readonly [A, B]>;
  zipWith<S, R, E, A, S2, R2, E2, B, C>(
    as: Stream<S, R, E, A>,
    bs: Stream<S2, R2, E2, B>,
    f: F.FunctionN<[A, B], C>
  ): AsyncRE<R & R2, E | E2, C>;
}

export const stream: Monad4EP<URI> & StreamF = {
  URI,
  _CTX: "async",
  map: map_,
  of: <S, R, E, A>(a: A): Stream<S, R, E, A> => (once(a) as any) as Stream<S, R, E, A>,
  ap: <S1, S2, R, R2, E, E2, A, B>(
    sfab: Stream<S1, R, E, F.FunctionN<[A], B>>,
    sa: Stream<S2, R2, E2, A>
  ) => zipWith_(sfab, sa, (f, a) => f(a)),
  chain: chain_,
  as: as_,
  chainMerge: chainMerge_,
  chainSwitchLatest: chainSwitchLatest_,
  concat: concat_,
  concatL: concatL_,
  distinctAdjacent: distinctAdjacent_,
  drop: drop_,
  dropWhile: dropWhile_,
  filter: filter_,
  fold: fold_,
  foldM: foldM_,
  into: into_,
  intoLeftover: intoLeftover_,
  intoManaged: intoManaged_,
  mapM: mapM_,
  merge: merge_,
  peel: peel_,
  peelManaged: peelManaged_,
  scan: scan_,
  scanM: scanM_,
  take: take_,
  takeWhile: takeWhile_,
  takeUntil: takeUntil_,
  transduce: transduce_,
  zip: zip_,
  zipWith: zipWith_
};

/* extensions */

/* istanbul ignore next */
function getSourceFromObjectReadStream<A>(
  stream: Readable
): M.Sync<T.AsyncE<Error, O.Option<A>>> {
  return M.managed.chain(
    M.encaseEffect(
      T.sync(() => {
        const { next, ops, hasCB } = su.queueUtils<Error, A>();

        stream.on("end", () => {
          next({ _tag: "complete" });
        });

        stream.on("error", (e) => {
          next({ _tag: "error", e: Ei.toError(e) });
        });

        stream.pipe(
          new Writable({
            objectMode: true,
            write(chunk, _, callback) {
              next({ _tag: "offer", a: chunk });

              callback();
            }
          })
        );

        return { ops, hasCB };
      })
    ),
    ({ hasCB, ops }) => su.emitter(ops, hasCB)
  );
}

/* istanbul ignore next */
export function fromObjectReadStream<A>(stream: Readable) {
  return fromSource(getSourceFromObjectReadStream<A>(stream));
}

// TODO: generalize this to batch over generic stream
/* istanbul ignore next */
function getSourceFromObjectReadStreamB<A>(
  stream: ReadStream,
  batch: number,
  every: number
): M.SyncE<Error, T.AsyncE<Error, O.Option<Array<A>>>> {
  return M.encaseEffect(
    T.sync(() => {
      let open = true;
      const leftover: Array<any> = [];
      const errors: Array<Error> = [];

      stream.on("end", () => {
        open = false;
      });

      stream.on("error", (e) => {
        errors.push(e);
      });

      stream.pipe(
        new Writable({
          objectMode: true,
          write(chunk, _, callback) {
            leftover.push(chunk);

            callback();
          }
        })
      );

      return T.delay(
        T.async((res) => {
          if (leftover.length > 0) {
            res(Ei.right(O.some(leftover.splice(0, batch))));
          } else {
            if (errors.length > 0) {
              res(Ei.left(errors[0]));
            } else {
              if (open) {
                res(Ei.right(O.some([])));
              } else {
                res(Ei.right(O.none));
              }
            }
          }

          // tslint:disable-next-line: no-empty
          return (cb) => {
            cb();
          };
        }),
        every
      );
    })
  );
}

/* istanbul ignore next */
export function fromObjectReadStreamB<A>(stream: ReadStream, batch: number, every: number) {
  return fromSource(getSourceFromObjectReadStreamB<A>(stream, batch, every));
}

export { su };

export const Do = DoG(stream);
export const sequenceS = SS(stream);
export const sequenceT = ST(stream);

export const sequenceOption = O.option.sequence(stream);

export const traverseOption: <S, A, R, E, B>(
  f: (a: A) => Stream<S, R, E, B>
) => (ta: O.Option<A>) => AsyncRE<R, E, O.Option<B>> = (f) => (ta) =>
  O.option.traverse(stream)(ta, f);

export const wiltOption: <S, A, R, E, B, C>(
  f: (a: A) => Stream<S, R, E, Ei.Either<B, C>>
) => (wa: O.Option<A>) => AsyncRE<R, E, Separated<O.Option<B>, O.Option<C>>> = (f) => (wa) =>
  O.option.wilt(stream)(wa, f);

export const witherOption: <S, A, R, E, B>(
  f: (a: A) => Stream<S, R, E, O.Option<B>>
) => (ta: O.Option<A>) => AsyncRE<R, E, O.Option<B>> = (f) => (ta) =>
  O.option.wither(stream)(ta, f);

export const sequenceEither = Ei.either.sequence(stream);

export const traverseEither: <S, A, R, FE, B>(
  f: (a: A) => Stream<S, R, FE, B>
) => <TE>(ta: Ei.Either<TE, A>) => AsyncRE<R, FE, Ei.Either<TE, B>> = (f) => (ta) =>
  Ei.either.traverse(stream)(ta, f);

export const sequenceTree = TR.tree.sequence(stream);

export const traverseTree: <S, A, R, E, B>(
  f: (a: A) => Stream<S, R, E, B>
) => (ta: TR.Tree<A>) => AsyncRE<R, E, TR.Tree<B>> = (f) => (ta) => TR.tree.traverse(stream)(ta, f);

export const sequenceArray = A.array.sequence(stream);

export const traverseArray: <S, A, R, E, B>(
  f: (a: A) => Stream<S, R, E, B>
) => (ta: Array<A>) => AsyncRE<R, E, Array<B>> = (f) => (ta) => A.array.traverse(stream)(ta, f);

export const traverseArrayWithIndex: <S, A, R, E, B>(
  f: (i: number, a: A) => Stream<S, R, E, B>
) => (ta: Array<A>) => AsyncRE<R, E, Array<B>> = (f) => (ta) =>
  A.array.traverseWithIndex(stream)(ta, f);

export const wiltArray: <S, A, R, E, B, C>(
  f: (a: A) => Stream<S, R, E, Ei.Either<B, C>>
) => (wa: Array<A>) => AsyncRE<R, E, Separated<Array<B>, Array<C>>> = (f) => (wa) =>
  A.array.wilt(stream)(wa, f);

export const witherArray: <S, A, R, E, B>(
  f: (a: A) => Stream<S, R, E, O.Option<B>>
) => (ta: Array<A>) => AsyncRE<R, E, Array<B>> = (f) => (ta) => A.array.wither(stream)(ta, f);
