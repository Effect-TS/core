import { eff as T, exit as EX } from "../src";
import * as assert from "assert";
import { pipe } from "fp-ts/lib/pipeable";

describe("Eff", () => {
  it("should compose sync", () => {
    const program = pipe(
      T.access((_: { n: number }) => _.n),
      T.chain((n) => T.sync(() => n + 1)),
      T.retype
    );

    const result = pipe(
      program,
      T.provideAll({
        n: 1,
      }),
      T.runSync
    );

    assert.deepEqual(result, EX.done(2));
  });
});
