import * as T from "../src/effect";
import { Do } from "fp-ts-contrib/lib/Do";
import * as assert from "assert";
import { array } from "fp-ts/lib/Array";
import { pipe } from "fp-ts/lib/pipeable";

const foo: unique symbol = Symbol();
const bar: unique symbol = Symbol();

interface TestEnv {
  [foo]: string;
}

interface TestEnv2 {
  [bar]: string;
}

describe("Env", () => {
  it("merge env", async () => {
    const program = T.accessM(({ [foo]: fooS, [bar]: barS }: TestEnv & TestEnv2) =>
      T.sync(() => `${fooS}-${barS}`)
    );

    const result = await T.runToPromise(
      pipe(program, T.provideAll({ [foo]: "foo", [bar]: "bar" }))
    );

    assert.deepEqual(result, "foo-bar");
  });
  it("env should work", async () => {
    const res = await T.runToPromise(
      Do(T.effect)
        .bindL("a", () =>
          T.provideAll<TestEnv>({ [foo]: "a" })(
            T.delay(
              T.access(({ [foo]: s }: TestEnv) => s),
              100
            )
          )
        )
        .bindL("b", () =>
          T.provideAll<TestEnv>({ [foo]: "b" })(T.access(({ [foo]: s }: TestEnv) => s))
        )
        .return((s) => `${s.a} - ${s.b}`)
    );

    assert.deepEqual(res, "a - b");
  });

  it("env should work - par", async () => {
    const res = await T.runToPromise(
      array.sequence(T.parEffect)([
        T.provideAll<TestEnv>({ [foo]: "a" })(
          T.delay(
            T.access(({ [foo]: s }: TestEnv) => s),
            1000
          )
        ),
        T.provideAll<TestEnv>({ [foo]: "b" })(T.access(({ [foo]: s }: TestEnv) => s))
      ])
    );

    assert.deepEqual(res.join(" - "), "a - b");
  });
});
