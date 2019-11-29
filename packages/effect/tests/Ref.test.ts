import * as T from "../src";
import * as R from "../src/ref";
import * as assert from "assert";
import { Do } from "fp-ts-contrib/lib/Do";

type Config = { initial: number };

describe("Ref", () => {
  it("should use ref", async () => {
    const program = Do(T.effect)
      .bindL("initial", () => T.access(({ initial }: Config) => initial))
      .bindL("ref", ({ initial }) => R.makeRef(initial))
      .bindL("next", ({ ref }) => ref.modify(n => [n + 1, n + 1] as const))
      .doL(({ ref, next }) => ref.set(next + 1))
      .doL(({ ref }) => ref.update(n => n + 1))
      .bindL("result", ({ ref }) => ref.get)
      .return(s => s.result);

    const result = await T.runToPromise(
      T.provide<Config>({ initial: 0 })(program)
    );

    assert.deepEqual(result, 3);
  });
});
