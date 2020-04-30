import * as assert from "assert";
import * as O from "../src/operators";
import * as Rx from "rxjs";
import { filter, catchError } from "rxjs/operators";
import { T } from "@matechs/prelude";

describe("Operators", () => {
  it("chainEffect", async () => {
    const numbers: number[] = [];

    Rx.from([0, 1, 2, 3])
      .pipe(filter((n) => n % 2 === 0))
      .pipe(
        O.chainEffect((n) =>
          T.sync(() => {
            numbers.push(n);
          })
        )
      )
      .subscribe();

    assert.deepStrictEqual(numbers, [0, 2]);
  });

  it("chainEffect effect raise", async () => {
    const numbers: number[] = [];
    const errors: any[] = [];

    Rx.from([0, 1, 2, 3])
      .pipe(filter((n) => n % 2 === 0))
      .pipe(O.chainEffect(() => T.raiseError("error")))
      .pipe(
        catchError((e, o) => {
          errors.push(e);
          return o;
        })
      )
      .subscribe();

    assert.deepStrictEqual(numbers, []);
    assert.deepStrictEqual(errors, ["error", "error"]);
  });

  it("chainEffect effect abort", async () => {
    const numbers: number[] = [];
    const errors: any[] = [];

    Rx.from([0, 1, 2, 3])
      .pipe(filter((n) => n % 2 === 0))
      .pipe(O.chainEffect(() => T.raiseAbort("error")))
      .pipe(
        catchError((e, o) => {
          errors.push(e);
          return o;
        })
      )
      .subscribe();

    assert.deepStrictEqual(numbers, []);
    assert.deepStrictEqual(errors, ["error", "error"]);
  });

  it("chainEffect effect interrupt", async () => {
    const numbers: number[] = [];
    const errors: any[] = [];

    Rx.from([0, 1, 2, 3])
      .pipe(filter((n) => n % 2 === 0))
      .pipe(O.chainEffect(() => T.raiseInterrupt))
      .pipe(
        catchError((e) => {
          errors.push(e);
          return Rx.from([]);
        })
      )
      .subscribe();

    assert.deepStrictEqual(numbers, []);
    assert.deepStrictEqual(errors, []);
  });

  it("chainEffect observable error", async () => {
    const numbers: number[] = [];
    const errors: any[] = [];

    Rx.concat(Rx.from([0, 1, 2, 3]), Rx.throwError("error"))
      .pipe(filter((n) => n % 2 === 0))
      .pipe(
        O.chainEffect((n) =>
          T.sync(() => {
            numbers.push(n);
          })
        )
      )
      .pipe(
        catchError((e) => {
          errors.push(e);
          return Rx.EMPTY;
        })
      )
      .subscribe();

    assert.deepStrictEqual(numbers, [0, 2]);
    assert.deepStrictEqual(errors, ["error"]);
  });
});
