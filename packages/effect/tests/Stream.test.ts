import * as assert from "assert";
import { expect } from "chai";
import * as array from "fp-ts/lib/Array";
import { eqNumber } from "fp-ts/lib/Eq";
import { FunctionN, identity, constant } from "fp-ts/lib/function";
import { none, some } from "fp-ts/lib/Option";
import { pipe } from "fp-ts/lib/pipeable";
import { Do } from "fp-ts-contrib/lib/Do";
import { Readable } from "stream";
import * as ex from "../src/original/exit";
import * as SK from "../src/stream/sink";
import { collectArraySink, liftPureSink, Sink } from "../src/stream/sink";
import { sinkCont, sinkDone, SinkStep } from "../src/stream/step";
import { effect as T, managed as M, ref, stream as S } from "../src";

export async function expectExitIn<E, A, B>(
  ioa: T.Effect<T.AsyncRT, E, A>,
  f: FunctionN<[ex.Exit<E, A>], B>,
  expected: B
): Promise<void> {
  const result = await T.runToPromiseExit(ioa);
  expect(assert.deepEqual(f(result), expected));
}

export function expectExit<E, A>(
  ioa: T.Effect<T.AsyncRT, E, A>,
  expected: ex.Exit<E, A>
): Promise<void> {
  return expectExitIn(ioa, identity, expected);
}

describe("Stream", () => {
  it("fromObjectReadStream", async () => {
    let eventCount = 0;

    const s: S.Stream<T.AsyncRT, Error, { n: number }> = S.fromObjectReadStream(
      new Readable({
        objectMode: true,
        read() {
          if (eventCount < 10) {
            eventCount = eventCount + 1;
            this.push({ n: eventCount });
          } else {
            this.push(null);
          }
        }
      })
    );

    const res = await T.runToPromise(S.collectArray(S.stream.map(s, ({ n }) => n)));

    assert.deepEqual(res, array.range(1, 10));
  });

  it("fromObjectReadStream - Error", async () => {
    let eventCount = 0;

    const s: S.Stream<T.AsyncRT, Error, { n: number }> = S.fromObjectReadStream(
      new Readable({
        objectMode: true,
        read() {
          if (eventCount < 10) {
            eventCount = eventCount + 1;
            this.push({ n: eventCount });
          } else {
            this.destroy(new Error("test"));
          }
        }
      })
    );

    const res = await pipe(
      s,
      S.mapM(({ n }) => T.delay(T.pure(n), 100)),
      S.collectArray,
      T.runToPromiseExit
    );

    assert.deepEqual(res, ex.raise(new Error("test")));
  });

  it("stack safe", async () => {
    const s = S.fromArray(array.range(0, 100000));

    const res = await pipe(
      s,
      S.foldM(0, (b, a) => T.pure(b + a)),
      S.collectArray,
      T.runToPromise
    );

    assert.deepEqual(res, [5000050000]);
  });

  it("should use fromArray", async () => {
    const s = S.fromArray([0, 1, 2]);

    const res = await T.runToPromise(S.collectArray(s));

    assert.deepEqual(res, [0, 1, 2]);
  });

  it("should use fromRange", async () => {
    const s = S.fromRange(0);

    const res = await pipe(s, S.take(3), S.collectArray, T.runToPromise);

    assert.deepEqual(res, [0, 1, 2]);
  });

  it("should use filterRefine", async () => {
    const s = S.fromRange(0);

    type Even = number & { _brand: "even" };

    function isEven(x: number): x is Even {
      return x % 2 === 0;
    }

    // $ExpectType Even[]
    const res = await pipe(s, S.filterRefine(isEven), S.take(3), S.collectArray, T.runToPromise);

    assert.deepEqual(res, [0, 2, 4]);
  });

  it("should use once", async () => {
    const s = S.once(0);

    const res = await T.runToPromise(S.collectArray(s));

    assert.deepEqual(res, [0]);
  });

  it("should use repeatedly", async () => {
    const s = S.repeatedly(0);

    const res = await pipe(s, S.take(3), S.collectArray, T.runToPromise);
    assert.deepEqual(res, [0, 0, 0]);
  });

  it("should use periodically", async () => {
    const s = S.periodically(10);

    const res = await pipe(
      s,
      S.takeWhile((n) => n < 10),
      S.collectArray,
      T.runToPromise
    );

    assert.deepEqual(res, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("should use empty", async () => {
    const s = S.empty;

    const res = await T.runToPromise(S.collectArray(s));

    assert.deepEqual(res, []);
  });

  it("should use raised", async () => {
    const s = S.raised("message");

    const res = await T.runToPromiseExit(S.collectArray(s));

    assert.deepEqual(res, ex.raise("message"));
  });

  it("should use aborted", async () => {
    const s = S.aborted("message");

    const res = await T.runToPromiseExit(S.collectArray(s));

    assert.deepEqual(res, ex.abort("message"));
  });

  it("should use fromOption - none", async () => {
    const s = S.fromOption(none);

    const res = await T.runToPromise(S.collectArray(s));

    assert.deepEqual(res, []);
  });

  it("should use fromOption - some", async () => {
    const s = S.fromOption(some(1));

    const res = await T.runToPromise(S.collectArray(s));

    assert.deepEqual(res, [1]);
  });

  it("should use zipWithIndex", async () => {
    const s = S.zipWithIndex(S.fromArray([0, 1]));

    const res = await T.runToPromise(S.collectArray(s));

    assert.deepEqual(res, [
      [0, 0],
      [1, 1]
    ]);
  });

  it("should use map", async () => {
    const s = pipe(
      S.fromArray([0, 1, 2]),
      S.map((n) => n + 1)
    );

    const res = await T.runToPromise(S.collectArray(s));

    assert.deepEqual(res, [1, 2, 3]);
  });

  it("should use as", async () => {
    const s = pipe(S.fromArray([0]), S.as(1));

    const res = await T.runToPromise(S.collectArray(s));

    assert.deepEqual(res, [1]);
  });

  it("should use filter", async () => {
    const s = pipe(
      S.fromArray([0]),
      S.filter((n) => n > 0)
    );

    const res = await T.runToPromise(S.collectArray(s));

    assert.deepEqual(res, []);
  });

  it("should use filter - 2", async () => {
    const s = pipe(
      S.fromArray([1]),
      S.filter((n) => n > 0)
    );

    const res = await T.runToPromise(S.collectArray(s));

    assert.deepEqual(res, [1]);
  });

  it("should use distinctAdjacent", async () => {
    const s = pipe(S.fromArray([0, 0, 1, 2, 2, 3]), S.distinctAdjacent(eqNumber));

    const res = await T.runToPromise(S.collectArray(s));

    assert.deepEqual(res, [0, 1, 2, 3]);
  });

  it("should use drop", async () => {
    const s = pipe(S.fromArray([0]), S.drop(1));

    const res = await T.runToPromise(S.collectArray(s));

    assert.deepEqual(res, []);
  });

  it("should use dropWhile", async () => {
    const s = pipe(
      S.fromArray([0]),
      S.dropWhile((n) => n === 0)
    );

    const res = await T.runToPromise(S.collectArray(s));

    assert.deepEqual(res, []);
  });

  it("should use zipWith", async () => {
    const sl = S.empty;
    const sr = S.empty;
    const z = pipe(
      sl,
      S.zipWith(sr, (_l, _r) => 0)
    );

    const res = await T.runToPromise(S.collectArray(z));

    assert.deepEqual(res, []);
  });

  it("should use zipWith - 2", async () => {
    const sl = S.fromArray([0, 1, 2]);
    const sr = S.fromArray([] as number[]);
    // tslint:disable-next-line: restrict-plus-operands
    const z = pipe(
      sl,
      S.zipWith(sr, (l, r) => l + r)
    );

    const res = await T.runToPromise(S.collectArray(z));

    assert.deepEqual(res, []);
  });

  it("should use drop - 2", async () => {
    const s = pipe(S.fromArray([0, 1]), S.drop(1));

    const res = await T.runToPromise(S.collectArray(s));

    assert.deepEqual(res, [1]);
  });

  it("should use intoManaged", async () => {
    const sm = M.pure(collectArraySink<T.NoEnv, T.NoErr, number>());

    const s = pipe(S.fromArray([0, 1, 2]), S.intoManaged(sm));

    const res = await T.runToPromise(s);

    assert.deepEqual(res, [0, 1, 2]);
  });

  it("should use into", async () => {
    const sm = collectArraySink<T.NoEnv, T.NoErr, number>();

    const s = pipe(S.fromArray([0, 1, 2]), S.into(sm));

    const res = await T.runToPromise(s);

    assert.deepEqual(res, [0, 1, 2]);
  });

  it("should use intoLeftover", async () => {
    const sl = collectArraySink<T.NoEnv, T.NoErr, number>();

    const s = pipe(S.fromArray([0, 1, 2]), S.intoLeftover(sl));

    const res = await T.runToPromise(s);

    assert.deepEqual(res, [[0, 1, 2], []]);
  });

  it("should use fold", async () => {
    const s = pipe(
      S.fromArray([1, 1, 1]),
      S.fold(0, (n, e) => n + e)
    );

    const res = await T.runToPromise(S.collectArray(s));

    assert.deepEqual(res, [3]);
  });

  it("should use fold - 2", async () => {
    const s = pipe(
      S.fromArray([] as number[]),
      S.fold(0, (n, e) => n + e)
    );

    const res = await T.runToPromise(S.collectArray(s));

    assert.deepEqual(res, [0]);
  });

  it("should use scan", async () => {
    const s = pipe(
      S.fromArray([1, 1, 1]),
      S.scan(0, (n, e) => n + e)
    );

    const res = await T.runToPromise(S.collectArray(s));

    assert.deepEqual(res, [0, 1, 2, 3]);
  });

  it("should use scanM", async () => {
    const s = pipe(
      S.fromArray([1, 1, 1]),
      S.scanM(0, (n, e) => T.pure(n + e))
    );

    const res = await T.runToPromise(S.collectArray(s));

    assert.deepEqual(res, [0, 1, 2, 3]);
  });

  it("should use flatten", async () => {
    const s = S.flatten(S.fromArray([S.fromArray([0, 1, 2]), S.fromArray([0, 1, 2])]));

    const res = await T.runToPromise(S.collectArray(s));

    assert.deepEqual(res, [0, 1, 2, 0, 1, 2]);
  });

  it("should use ap", async () => {
    const res = await pipe(
      S.stream.ap(
        S.once((n: number) => n + 1),
        S.once(1)
      ),
      S.collectArray,
      T.runToPromiseExit
    );
    assert.deepEqual(res, ex.done([2]));
  });

  it("should use mapM", async () => {
    const s = pipe(
      S.fromArray([0, 1, 2]),
      S.mapM((n) => T.pure(n + 1))
    );

    const res = await T.runToPromise(S.collectArray(s));

    assert.deepEqual(res, [1, 2, 3]);
  });

  it("should use concat", async () => {
    const s = pipe(S.fromArray([0]), S.concat(S.fromOption(some(1))));

    const res = await T.runToPromise(S.collectArray(s));

    assert.deepEqual(res, [0, 1]);
  });

  it("should use concatL", async () => {
    const s = pipe(
      S.fromArray([0]),
      S.concatL(() => S.fromOption(some(1)))
    );

    const res = await T.runToPromise(S.collectArray(s));

    assert.deepEqual(res, [0, 1]);
  });

  it("should use fromIteratorUnsafe", async () => {
    function makeRangeIterator(start = 0, end = Infinity, step = 1) {
      let nextIndex = start;
      let iterationCount = 0;

      const rangeIterator = {
        next: function () {
          let result: any;
          if (nextIndex < end) {
            result = { value: nextIndex, done: false };
            nextIndex += step;
            iterationCount++;
            return result;
          }
          return { value: iterationCount, done: true };
        }
      };
      return rangeIterator;
    }

    const s = S.fromIteratorUnsafe(makeRangeIterator(1, 10, 2));

    const res = await T.runToPromise(S.collectArray(s));

    assert.deepEqual(res, [1, 3, 5, 7, 9]);
  });

  it("should zip two streams", async () => {
    interface EnvA {
      a: number;
    }
    interface EnvB {
      b: number;
    }

    const streamA = S.repeat(S.encaseEffect(T.access(({ a }: EnvA) => a)));
    const streamB = S.repeat(S.encaseEffect(T.access(({ b }: EnvB) => b)));

    const zip = pipe(streamA, S.zip(streamB), S.take(3), S.collectArray);

    const res = await T.runToPromise(T.provide<EnvA & EnvB>({ a: 1, b: 1 })(zip));

    assert.deepEqual(res, [
      [1, 1],
      [1, 1],
      [1, 1]
    ]);
  });

  it("should use stream with environment", async () => {
    interface Config {
      initial: number;
    }
    interface ConfigB {
      second: number;
    }

    const a = S.encaseEffect(T.access(({ initial }: Config) => initial)); // $ExpectType Stream<Config, never, number>
    const s = S.stream.chain(a, (n) => S.fromRange(n, 1, 10)); // $ExpectType Stream<Config, never, number>

    // $ExpectType Stream<Config & ConfigB, never, number>
    const m = S.stream.chain(s, (n) =>
      S.encaseEffect(T.access(({ second }: ConfigB) => n + second))
    );

    const g = S.stream.chain(m, (n) => S.fromRange(0, 1, n)); // $ExpectType Stream<Config & ConfigB, never, number>
    const r = S.collectArray(g); // $ExpectType Effect<Config & ConfigB, never, number[]>

    const res = await T.runToPromise(
      T.provide<Config & ConfigB>({
        initial: 1,
        second: 1
      })(r)
    );

    assert.deepEqual(
      res,
      // prettier-ignore
      [ 0, 1, 0, 1, 2, 0, 1, 2, 3, 0, 1, 2
      , 3, 4, 0, 1, 2, 3, 4, 5, 0, 1, 2, 3
      , 4, 5, 6, 0, 1, 2, 3, 4, 5, 6, 7, 0
      , 1, 2, 3, 4, 5, 6, 7, 8, 0, 1, 2, 3
      , 4, 5, 6, 7, 8, 9]
    );
  });

  it("should use stream with environment with pipe ", async () => {
    interface Config {
      initial: number;
    }
    interface ConfigB {
      second: number;
    }

    const a = S.encaseEffect(T.access(({ initial }: Config) => initial)); // $ExpectType Stream<Config, never, number>
    const s = pipe(
      // $ExpectType Stream<Config, never, number>
      a,
      S.chain((n) => S.fromRange(n, 1, 10))
    );

    // $ExpectType Stream<Config & ConfigB, never, number>
    const m = pipe(
      s,
      S.chain((n) => S.encaseEffect(T.access(({ second }: ConfigB) => n + second)))
    );

    // $ExpectType Stream<Config & ConfigB, never, number>
    const g = pipe(
      // $ExpectType Stream<Config & ConfigB, never, number>
      m,
      S.chain((n) => S.fromRange(0, 1, n))
    );
    const r = S.collectArray(g); // $ExpectType Effect<Config & ConfigB, never, number[]>

    const res = await T.runToPromise(
      T.provide<Config & ConfigB>({
        initial: 1,
        second: 1
      })(r)
    );

    assert.deepEqual(
      res,
      // prettier-ignore
      [ 0, 1, 0, 1, 2, 0, 1, 2, 3, 0, 1, 2
      , 3, 4, 0, 1, 2, 3, 4, 5, 0, 1, 2, 3
      , 4, 5, 6, 0, 1, 2, 3, 4, 5, 6, 7, 0
      , 1, 2, 3, 4, 5, 6, 7, 8, 0, 1, 2, 3
      , 4, 5, 6, 7, 8, 9]
    );
  });

  // from https://github.com/rzeigler/waveguide-streams/blob/master/test/stream.spec.ts
  describe("peel", () => {
    const multiplier = SK.map(SK.headSink<T.NoEnv, never, number>(), (opt) =>
      opt._tag === "Some" ? opt.value : 1
    );
    it("should handle empty arrays", () => {
      const s1 = (S.empty as any) as S.Stream<T.NoEnv, never, number>;
      const s2 = pipe(s1, S.peel(multiplier));
      return expectExit(S.collectArray(S.stream.chain(s2, ([_h, r]) => r)), ex.done([]));
    });
    it("should handle empty arrays (managed)", () => {
      const s1 = (S.empty as any) as S.Stream<T.NoEnv, never, number>;
      const s2 = pipe(s1, S.peelManaged(M.pure(multiplier)));
      return expectExit(S.collectArray(S.stream.chain(s2, ([_h, r]) => r)), ex.done([]));
    });
    it("should extract a head and return a subsequent element", () => {
      const s1 = S.fromArray([2, 6, 9]);
      const s2 = pipe(
        s1,
        S.peel(multiplier),
        S.chain(([head, rest]) => S.stream.map(rest, (v) => v * head))
      );
      return expectExit(S.collectArray(s2), ex.done([12, 18]));
    });
    it("should compose", () => {
      const s1 = S.fromRange(3, 1, 9); // emits 3, 4, 5, 6, 7, 8
      const s2 = S.stream.filter(s1, (x) => x % 2 === 0); // emits 4 6 8
      const s3 = S.stream.chain(
        S.stream.peel(s2, multiplier),
        ([head, rest]) =>
          // head is 4
          S.stream.map(rest, (v) => v * head) // emits 24 32
      );
      return expectExit(S.collectArray(s3), ex.done([24, 32]));
    });
    it("should raise errors", () => {
      const s1 =
        (S.fromArray([S.raised("boom"), S.once(1)]) as any) as
        S.Stream<T.NoEnv, string, S.Stream<T.NoEnv, string, number>>;
      const s2 = S.flatten(s1);
      const s3 = S.stream.peel(s2, multiplier);
      return expectExit(S.collectArray(s3), ex.raise("boom"));
    });
    it("should raise errors in the remainder stream", () => {
      const s1 =
        (S.fromArray([S.once(2), S.raised("boom"), S.once(1)]) as any) as
        S.Stream<T.NoEnv, string, S.Stream<T.NoEnv, string, number>>;
      const s2 = S.flatten(s1);
      const s3 = S.stream.chain(S.stream.peel(s2, multiplier), ([_head, rest]) => rest);
      return expectExit(S.collectArray(s3), ex.raise("boom"));
    });
  });

  describe("transduce", () => {
    // We describe transduction as the process of consuming some elements (1 or more) to produce an output element
    // The transducer used for the test is a summer
    // i.e. it consumes the number of elements to read, then that number of elements, and then outputs the sum
    function transducer(): Sink<T.NoEnv, never, readonly [number, number], number, number> {
      const initial = sinkCont([-1, 0] as const);

      function step(
        state: readonly [number, number],
        next: number
      ): SinkStep<never, readonly [number, number]> {
        if (state[0] < 0) {
          return sinkCont([next, 0] as const);
        }
        if (state[0] === 1) {
          return sinkDone([0 as number, state[1] + next] as const, [] as never[]);
        }
        return sinkCont([state[0] - 1, state[1] + next] as const);
      }

      function extract(state: readonly [number, number]): number {
        return state[1];
      }

      return liftPureSink({ initial, step, extract });
    }

    it("should perform transduction", () => {
      const s1 = S.fromArray([2, 4, 6, 3, -10, -20, -30, 2]);
      const s2 = pipe(s1, S.transduce(transducer()));
      return expectExit(S.collectArray(s2), ex.done([10, -60, 0]));
    });

    it("should transduce empty streams", () => {
      const s1 = S.fromArray([] as Array<number>);
      const s2 = pipe(s1, S.transduce(transducer()));
      return expectExit(S.collectArray(s2), ex.done([]));
    });

    function slidingBuffer(): Sink<T.NoEnv, never, number[], number, number[]> {
      const initial = sinkCont([] as number[]);

      function step(state: number[], next: number): SinkStep<number, number[]> {
        const more = [...state, next];
        if (more.length === 3) {
          return sinkDone(more, more.slice(1));
        } else {
          return sinkCont(more);
        }
      }

      function extract(state: number[]): number[] {
        return state;
      }

      return liftPureSink({ initial, step, extract });
    }

    it("should handle remainders set correctly", () => {
      const s1 = S.fromRange(0, 1, 5);
      const s2 = pipe(s1, S.transduce(slidingBuffer()));
      return expectExit(
        S.collectArray(s2),
        ex.done([
          [0, 1, 2],
          [1, 2, 3],
          [2, 3, 4],
          [3, 4] // final emission happens here but there is no way of filling the buffer beyond
        ])
      );
    });
  });

  describe("switchLatest", () => {
    it("should produce the latest elements", () => {
      // Two streams that emit 2 elements then hang forever
      const s1 = S.stream.take(S.periodically(50), 2);
      const s2 = S.stream.as(
        s1,
        S.stream.concat(
          S.stream.take(S.periodically(10), 2),
          (S.never as any) as S.Stream<T.NoEnv, never, number>
        )
      );
      // A third stream that emits 3 elements
      const after30 = T.as(T.after(50), S.stream.take(S.periodically(20), 4));

      const s3 = S.switchLatest(S.stream.concat(s2, S.encaseEffect(after30)));
      return expectExit(S.collectArray(s3), ex.done([0, 1, 0, 1, 0, 1, 2, 3]));
    });
    it("should fail with errors in outer stream", () => {
      const io = T.effect.chain(ref.makeRef(0), (cell) => {
        const s1: T.Effect<T.NoEnv, string, S.Stream<T.NoEnv, string, number>> =
          T.delay(T.pure(S.encaseEffect(cell.set(1))), 50) as any;
        const s2: T.Effect<T.NoEnv, string, S.Stream<T.NoEnv, string, number>> =
          T.delay(T.raiseError("boom"), 50) as any;
        const s3: T.Effect<T.NoEnv, string, S.Stream<T.NoEnv, string, number>> =
          T.delay(T.pure(S.encaseEffect(cell.set(2))), 50) as any;

        const set: S.Stream<
          T.NoEnv,
          string,
          T.Effect<T.NoEnv, string, S.Stream<T.NoEnv, string, number>>
        > = S.fromArray([s1, s2, s3]) as any;

        const stream: S.Stream<T.NoEnv, string, S.Stream<T.NoEnv, string, number>> = S.stream.mapM(
          set,
          identity
        );

        const drain = T.result(S.drain(S.switchLatest(stream)));
        return T.zip_(drain, T.delay(cell.get, 100));
      });
      return expectExit(
        io,
        ex.done([ex.raise("boom"), 1] as const) as
          ex.Exit<never, readonly [ex.Exit<string, void>, number]>
      );
    });
    it("should fail with errors in the inner streams", () => {
      const io = T.effect.chain(ref.makeRef(0), (cell) => {
        const s1: T.Effect<T.NoEnv, string, S.Stream<T.NoEnv, string, number>> =
          T.delay(T.pure(S.encaseEffect(cell.set(1))), 50) as any;
        const s2: T.Effect<T.NoEnv, string, S.Stream<T.NoEnv, string, number>> =
          T.delay(T.pure(S.encaseEffect(T.raiseError("boom"))), 50) as any;
        const s3: T.Effect<T.NoEnv, string, S.Stream<T.NoEnv, string, number>> =
          T.delay(T.pure(S.encaseEffect(cell.set(2))), 50) as any;

        const set: S.Stream<
          T.NoEnv,
          string,
          T.Effect<T.NoEnv, string, S.Stream<T.NoEnv, string, number>>
        > = S.fromArray([s1, s2, s3]) as any;

        const stream: S.Stream<T.NoEnv, string, S.Stream<T.NoEnv, string, number>> = S.stream.mapM(
          set,
          identity
        );

        const drain = T.result(S.drain(S.switchLatest(stream)));
        return T.zip_(drain, T.delay(cell.get, 100));
      });

      return expectExit(
        io,
        ex.done([ex.raise("boom"), 1] as const) as
          ex.Exit<never, readonly [ex.Exit<string, void>, number]>
      );
    });
    // TODO: issue https://github.com/rzeigler/waveguide-streams/issues/1
    it.skip("switching should occur", async () => {
      const s1 = S.stream.take(S.periodically(50), 10);
      const s2 = pipe(
        s1,
        S.chainSwitchLatest((i) => S.stream.as(S.stream.take(S.periodically(10), 10), i))
      );
      const output = S.collectArray(s2);
      const values = await T.runToPromise(output);
      const pairs = array.chunksOf(2)(values);
      pairs.forEach(([f, s]) => expect(values.lastIndexOf(f)).to.be.greaterThan(values.indexOf(s)));
    });
  });
  function repeater<E, A>(w: T.Effect<T.AsyncRT, E, A>, n: number): T.Effect<T.AsyncRT, E, A> {
    if (n <= 1) {
      return w;
    } else {
      return T.parApplySecond(w, repeater(w, n - 1));
    }
  }
  describe("merge", function () {
    jest.setTimeout(20000);

    const r = T.sync(() => Math.random());

    function range(max: number): T.Effect<T.NoEnv, never, number> {
      return T.effect.map(r, (n) => Math.round(n * max));
    }

    function randomWait(max: number): T.Effect<T.AsyncRT, never, void> {
      return T.effect.chain(range(max), (a) => T.after(a));
    }

    it("should merge", async () => {
      const res = await pipe(S.merge(1)(S.once(S.once(1))), S.collectArray, T.runToPromiseExit);
      assert.deepEqual(res, ex.done([1]));
    });

    it("should merge output", () => {
      const s1 = S.fromRange(0, 1, 10);
      const s2 = pipe(
        s1,
        S.chainMerge(4, (i) => S.stream.mapM(S.fromRange(0, 1, 20), () => T.as(randomWait(50), i)))
      );
      const output = S.collectArray(s2);
      const check = T.effect.chain(output, (values) =>
        T.sync(() => {
          const uniq = array.uniq(eqNumber)(values).sort();
          const stats = array.array.map(
            uniq,
            (u) =>
              [
                u,
                array.array.filter(values, (v) => v === u).length,
                values.indexOf(u),
                values.lastIndexOf(u)
              ] as const
          );
          stats.forEach(([_i, ct]) => {
            expect(ct).to.equal(20);
          });
          return;
        })
      );
      return T.runToPromise(repeater(check, 10));
    });
  });

  describe("takeUntil", function () {
    it("should take until", () => {
      const sleep = (ms: number) => pipe(T.delay(T.pure(true), ms));

      const program1 = Do(T.effect)
        .bind("list", pipe(S.periodically(50), S.takeUntil(sleep(200)), S.collectArray))
        .doL(({ list }) =>
          T.sync(() => {
            expect(list, "The output of program1 should be [0, 1, 2]").to.deep.equal([0, 1, 2]);
          })
        )
        .done();

      const program2 = Do(T.effect)
        .bind("list", pipe(S.periodically(50), S.takeUntil(sleep(225)), S.collectArray))
        .doL(({ list }) =>
          T.sync(() => {
            expect(list, "The output of program2 should be [0, 1, 2, 3]").to.deep.equal([
              0,
              1,
              2,
              3
            ]);
          })
        )
        .done();

      const program3 = Do(T.effect)
        .bind("index", ref.makeRef(-1))
        .doL(({ index }) =>
          pipe(
            S.periodically(50),
            S.chain((n) => S.encaseEffect(index.update(constant(n)))),
            S.takeUntil(sleep(225)),
            S.drain
          )
        )
        .doL(({ index }) =>
          T.delay(
            pipe(
              index.get,
              T.chain((result) =>
                T.sync(() => {
                  expect(
                    result,
                    "The 'periodically' stream will have terminated and the last reference update is 3"
                  ).to.equal(3);
                })
              )
            ),
            100
          )
        )
        .done();

      const mockEnvUri = Symbol();

      interface MockEnv {
        [mockEnvUri]: {
          foo: "bar";
        };
      }

      const program4 = pipe(
        T.accessM((_: MockEnv) => T.delay(T.pure(_[mockEnvUri].foo), 50)),
        S.encaseEffect,
        S.repeat,
        S.takeUntil(T.delay(T.pure(1), 100)),
        S.collectArray,
        T.chain((array) => T.sync(() => expect(array.length).to.eq(1)))
      );

      return pipe(
        Do(T.effect).do(program1).do(program2).do(program3).do(program4).done(),
        T.provideS({
          [mockEnvUri]: {
            foo: "bar"
          }
        } as MockEnv),
        T.runToPromise
      );
    });
  });
});
