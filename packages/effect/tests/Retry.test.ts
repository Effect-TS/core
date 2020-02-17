import { effect as T, retry as R, exit as E } from "../src";
import * as assert from "assert";
import { limitRetries } from "retry-ts";
import { function as F } from "fp-ts";

describe("Retry", () => {
  it("should retry", async () => {
    const program: T.IO<string, number> = R.retrying(
      limitRetries(2),
      ({ iterNumber }) => (iterNumber > 1 ? T.pure(0) : T.raiseError("error")),
      F.flow(E.isRaise, T.pure)
    );

    assert.deepEqual(await T.runToPromise(program), 0);
  });
});
