import * as assert from "assert";
import { effect as T } from "@matechs/effect";
import { Do } from "fp-ts-contrib/lib/Do";
import * as KOA from "../src";
import * as H from "@matechs/http-client";
import * as L from "@matechs/http-client-libcurl";
import { pipe } from "fp-ts/lib/pipeable";
import { raise, done } from "@matechs/effect/lib/original/exit";
import { some } from "fp-ts/lib/Option";

describe("Koa", () => {
  it("should use koa", async () => {
    const program = Do(T.effect)
      .do(
        KOA.route(
          "post",
          "/",
          KOA.accessReqM((r) => T.pure(KOA.routeResponse(r.path === "/" ? 200 : 500, { res: 1 })))
        )
      )
      .do(
        KOA.route(
          "post",
          "/access",
          KOA.accessReq((r) => KOA.routeResponse(r.path === "/access" ? 200 : 500, { res: 1 }))
        )
      )
      .do(KOA.route("post", "/bad", T.raiseError(KOA.routeError(500, { res: 1 }))))
      .do(KOA.route("post", "/bad2", T.raiseAbort("abort")))
      .do(KOA.route("post", "/bad3", T.raiseInterrupt))
      .do(
        KOA.accessApp((app) => {
          if (!app) {
            throw new Error("Aborted app not found");
          }
        })
      )
      .do(
        KOA.accessAppM((app) =>
          T.trySync(() => {
            if (!app) {
              throw new Error("Aborted app not found");
            }
          })
        )
      )
      .return(() => {
        //
      });

    const main = KOA.bracketWithApp(3003, "127.0.0.1")(program);

    const close = T.run(T.provideAll(KOA.koa)(main));

    const res = await T.runToPromiseExit(
      pipe(
        H.post("http://127.0.0.1:3003/", {}),
        T.chain((s) => T.fromOption(() => new Error("empty body"))(s.body)),
        T.provideS(L.client)
      )
    );

    const res2 = await T.runToPromiseExit(
      pipe(
        H.post("http://127.0.0.1:3003/bad", {}),
        T.mapError((s) => s._tag === H.HttpErrorReason.Response && s.response && s.response.body),
        T.chain((s) => T.fromOption(() => new Error("empty body"))(s.body)),
        T.provideS(L.client)
      )
    );

    const res3 = await T.runToPromiseExit(
      pipe(
        H.post("http://127.0.0.1:3003/bad2", {}),
        T.mapError((s) => s._tag === H.HttpErrorReason.Response && s.response && s.response.body),
        T.chain((s) => T.fromOption(() => new Error("empty body"))(s.body)),
        T.provideS(L.client)
      )
    );

    const res4 = await T.runToPromiseExit(
      pipe(
        H.post("http://127.0.0.1:3003/bad3", {}),
        T.mapError((s) => s._tag === H.HttpErrorReason.Response && s.response && s.response.body),
        T.chain((s) => T.fromOption(() => new Error("empty body"))(s.body)),
        T.provideS(L.client)
      )
    );

    const res5 = await T.runToPromiseExit(
      pipe(
        H.post("http://127.0.0.1:3003/access", {}),
        T.chain((s) => T.fromOption(() => new Error("empty body"))(s.body)),
        T.provideS(L.client)
      )
    );

    close();

    await T.runToPromise(T.delay(T.unit, 200));

    assert.deepEqual(res, done({ res: 1 }));
    assert.deepEqual(res5, done({ res: 1 }));
    assert.deepEqual(res2, raise(some(`{\"res\":1}`))); // TODO: verify we want that decoded as string
    assert.deepEqual(res3, raise(some(`{\"status\":\"aborted\",\"with\":\"abort\"}`)));
    assert.deepEqual(res4, raise(some(`{\"status\":\"interrupted\"}`)));
  });
});
