import { eff as Eff, effect as T, freeEnv as F, exit as EX } from "../src";
import * as assert from "assert";
import { pipe } from "fp-ts/lib/pipeable";
import { sequenceS, sequenceT } from "fp-ts/lib/Apply";
import { right } from "fp-ts/lib/Either";
import { Do } from "fp-ts-contrib/lib/Do";

const Service_ = F.define({
  demo: {
    getValue: F.cn<T.UIO<number>>()
  }
});

interface Service extends F.TypeOf<typeof Service_> {}

const Service = F.opaque<Service>()(Service_);

const {
  demo: { getValue }
} = F.accessEff(Service, { demo: { getValue: "s" } });

const provideService_ = F.implement(Service)({
  demo: {
    getValue: T.pure(1)
  }
});

const provideService = F.providerEff(provideService_, "s");
const provideServiceA = F.providerEff(provideService_, "a");

describe("Eff", () => {
  it("should access service sync", () => {
    const result = pipe(getValue, provideService, Eff.runSync);
    assert.deepEqual(result, EX.done(1));
  });
  it("should access service async", async () => {
    const result = await pipe(getValue, provideServiceA, Eff.runToPromiseExit);
    assert.deepEqual(result, EX.done(1));
  });
  it("should access service back to effect", async () => {
    const result = await pipe(getValue.effect(), F.providerT(provideServiceA), T.runToPromiseExit);
    assert.deepEqual(result, EX.done(1));
  });
  it("should compose sync", () => {
    // T.SyncEff<{ n: number; }, never, number>
    const program = pipe(
      Eff.access((_: { n: number }) => _.n),
      Eff.chain((n) => Eff.sync(() => n + 1))
    );

    const result = pipe(
      program,
      Eff.provideAll({
        n: 1
      }),
      Eff.runSync
    );

    assert.deepEqual(result, EX.done(2));
  });

  it("should compose sync - do", () => {
    // T.SyncEff<{ n: number; }, never, number>
    const program = Do(Eff.eff)
      .bindL("n", () => Eff.access((_: { n: number }) => _.n))
      .bindL("res", ({ n }) => Eff.sync(() => n + 1))
      .return((x) => x.res);

    const result = pipe(
      program,
      Eff.provideAll({
        n: 1
      }),
      Eff.runSync
    );

    assert.deepEqual(result, EX.done(2));
  });

  it("should compose async - do", async () => {
    // T.AyncEff<{ n: number; }, never, number>
    const program = Do(Eff.eff)
      .bindL("n", () => Eff.access((_: { n: number }) => _.n))
      .bindL("res", ({ n }) => Eff.sync(() => n + 1))
      .do(Eff.delay(Eff.unit, 1))
      .return((x) => x.res);

    const result = await pipe(
      program,
      Eff.provideAll({
        n: 1
      }),
      Eff.runToPromiseExit
    );

    assert.deepEqual(result, EX.done(2));
  });

  it("should compose sync using fluent", () => {
    // T.SyncEff<{ n: number; }, never, number>
    const program = Eff.accessEnvironment<{ n: number }>()
      .fluent()
      .chain((_) => Eff.sync(() => _.n + 1))
      .done();

    const result = pipe(
      program,
      Eff.provideAll({
        n: 1
      }),
      Eff.runSync
    );

    assert.deepEqual(result, EX.done(2));
  });

  it("should compose async using fluent", async () => {
    // T.AsyncEff<{ n: number; }, never, number>
    const program = Eff.accessEnvironment<{ n: number }>()
      .fluent()
      .chain((_) => Eff.sync(() => _.n + 1))
      .flow(Eff.shiftBefore)
      .done();

    const result = await pipe(
      program,
      Eff.provideAll({
        n: 1
      }),
      Eff.runToPromiseExit
    );

    assert.deepEqual(result, EX.done(2));
  });

  it("should compose async using sequence", async () => {
    const program = sequenceS(Eff.eff)({
      a: Eff.accessEnvironment<{ n: number }>()
        .fluent()
        .map((_) => _.n)
        .done(),
      b: Eff.delay(Eff.pure(1), 0)
    });

    const result = await pipe(
      program,
      Eff.provideAll({
        n: 1
      }),
      Eff.runToPromiseExit
    );

    assert.deepEqual(result, EX.done({ a: 1, b: 1 }));
  });

  it("should compose async using sequenceT", async () => {
    const program = sequenceT(Eff.eff)(
      Eff.accessEnvironment<{ n: number }>()
        .fluent()
        .map((_) => _.n)
        .done(),
      Eff.delay(Eff.pure(1), 0)
    );

    const result = await pipe(
      program,
      Eff.provideAll({
        n: 1
      }),
      Eff.runToPromiseExit
    );

    assert.deepEqual(result, EX.done([1, 1]));
  });

  it("should interop with effect", async () => {
    const program = sequenceS(Eff.eff)({
      a: Eff.accessEnvironment<{ n: number }>()
        .fluent()
        .map((_) => _.n)
        .done(),
      b: Eff.delay(Eff.pure(1), 0)
    });

    const result = await pipe(
      program.effect(),
      T.provideAll({
        n: 1
      }),
      T.runToPromiseExit
    );

    assert.deepEqual(result, EX.done({ a: 1, b: 1 }));
  });

  it("should encase sync effect", () => {
    const program = Eff.encaseSyncOrAbort(T.sync(() => 1));
    const result = Eff.runSync(program);

    assert.deepEqual(result, EX.done(1));
  });

  it("should encase sync effect - abort if async", () => {
    const program = Eff.encaseSyncOrAbort(
      T.async(() => (cb) => {
        cb();
      })
    );

    const result = Eff.runSync(program);

    assert.deepEqual(EX.isAbort(result), true);
  });

  it("should encase sync effect - map error if async", () => {
    const program = Eff.encaseSyncMap(
      T.async<never, number>((r) => {
        setTimeout(() => {
          r(right(1));
        }, 100);
        return (cb) => {
          cb();
        };
      }),
      () => "error"
    );

    const result = Eff.runSync(program);

    assert.deepEqual(result, EX.raise("error"));
  });

  it("should encase async effect", async () => {
    const program = Eff.encaseEffect(
      T.async<never, number>((r) => {
        const timer = setTimeout(() => {
          r(right(1));
        }, 100);
        return (cb) => {
          clearTimeout(timer);
          cb();
        };
      })
    );

    const result = await Eff.runToPromiseExit(program);

    assert.deepEqual(result, EX.done(1));
  });

  describe("compat", () => {
    it("use zipWith", () => {
      const result = pipe(
        Eff.zipWith(Eff.pure(1), Eff.pure(2), (x, y) => x + y),
        Eff.runSync
      );

      assert.deepEqual(result, EX.done(3));
    });
    it("use zip", () => {
      const result = pipe(Eff.zip(Eff.pure(1), Eff.pure(2)), Eff.runSync);

      assert.deepEqual(result, EX.done([1, 2]));
    });
  });
});
