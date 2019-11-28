import * as T from "@matechs/effect";
import * as S from "@matechs/effect/lib/stream";
import * as O from "../src";
import * as Rx from "rxjs";
import * as E from "fp-ts/lib/Either";
import * as A from "fp-ts/lib/Array";

import * as assert from "assert";
import { raise } from "waveguide/lib/exit";

describe("RxJS", () => {
  jest.setTimeout(5000);

  it("should encaseObservable", async () => {
    const s = O.encaseObservable(Rx.interval(10), E.toError);
    const p = S.collectArray(S.take(s, 10));

    const r = await T.runToPromise(p);

    assert.deepEqual(r, A.range(0, 9));
  });

  it("should encaseObservable - complete", async () => {
    const s = O.encaseObservable(Rx.from([0, 1, 2]), E.toError);
    const p = S.collectArray(s);

    const r = await T.runToPromise(p);

    assert.deepEqual(r, A.range(0, 2));
  });

  it("should encaseObservable - error", async () => {
    const s = O.encaseObservable(Rx.throwError(new Error("error")), E.toError);
    const p = S.collectArray(S.take(s, 10));

    const r = await T.runToPromiseExit(p);

    assert.deepEqual(r, raise(new Error("error")));
  });

  it("should runToObservable", async () => {
    const s = S.fromArray([0, 1, 2]);
    const o = O.toObservable(s);

    const a: number[] = [];

    O.runToObservable(o).subscribe(n => {
      a.push(n);
    });

    await T.runToPromise(T.delay(T.unit, 10));

    assert.deepEqual(a, [0, 1, 2]);
  });

  it("should runToObservable - Error", async () => {
    const s = S.raised("error");
    const o = O.toObservable(s);

    const a = [];
    const errors: unknown[] = [];

    O.runToObservable(o).subscribe(
      n => {
        a.push(n);
      },
      e => {
        errors.push(e);
      }
    );

    await T.runToPromise(T.delay(T.unit, 10));

    assert.deepEqual(errors, ["error"]);
  });

  it("should runToObservable - Abort", async () => {
    const s = S.aborted("error");
    const o = O.toObservable(s);

    const a = [];
    const errors: unknown[] = [];

    O.runToObservable(o).subscribe(
      n => {
        a.push(n);
      },
      e => {
        errors.push(e);
      }
    );

    await T.runToPromise(T.delay(T.unit, 10));

    assert.deepEqual(errors, ["error"]);
  });

  it("should toObservable - Error", async () => {
    const s = S.raised(new Error("error"));
    const o = O.toObservable(s);

    const r = await T.runToPromise(o);

    const a = [];
    const errors: unknown[] = [];

    const sub = r.subscribe(
      n => {
        a.push(n);
      },
      e => {
        errors.push(e);
      }
    );

    await T.runToPromise(T.delay(T.unit, 10));

    assert.deepEqual(errors, [new Error("error")]);
    assert.deepEqual(sub.closed, true);
  });

  it("should toObservable - Abort", async () => {
    const s = S.aborted("aborted");
    const o = O.toObservable(s);

    const r = await T.runToPromise(o);

    const a = [];
    const errors: unknown[] = [];

    const sub = r.subscribe(
      n => {
        a.push(n);
      },
      e => {
        errors.push(e);
      }
    );

    await T.runToPromise(T.delay(T.unit, 10));

    assert.deepEqual(errors, ["aborted"]);
    assert.deepEqual(sub.closed, true);
  });

  it("unsubscribe should stop drain", async () => {
    const s = S.chain(S.repeatedly(0), n =>
      S.encaseEffect(T.delay(T.pure(n), 10))
    );
    const o = O.toObservable(s);

    const r = await T.runToPromise(o);

    const a = [];
    const errors: unknown[] = [];

    const sub = r.subscribe(
      n => {
        a.push(n);
      },
      e => {
        errors.push(e);
      }
    );

    await T.runToPromise(T.delay(T.unit, 100));

    sub.unsubscribe();

    assert.deepEqual(errors, []);
    assert.deepEqual(sub.closed, true);
  });
});
