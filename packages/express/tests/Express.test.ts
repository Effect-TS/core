import * as assert from "assert";
import { effect as T } from "@matechs/effect";
import { Do } from "fp-ts-contrib/lib/Do";
import * as EX from "../src";
import * as H from "@matechs/http-client";
import * as L from "@matechs/http-client-libcurl";
import { pipe } from "fp-ts/lib/pipeable";
import { raise, done } from "@matechs/effect/lib/original/exit";
import { some } from "fp-ts/lib/Option";

describe("Express", () => {
  it("should use express", async () => {
    const program = EX.withApp(
      Do(T.effect)
        .do(
          EX.route(
            "post",
            "/",
            EX.accessReqM(r =>
              T.pure(EX.routeResponse(r.path === "/" ? 200 : 500, { res: 1 }))
            )
          )
        )
        .do(
          EX.route("post", "/bad", T.raiseError(EX.routeError(500, { res: 1 })))
        )
        .do(EX.route("post", "/bad2", T.raiseAbort("abort")))
        .do(EX.route("post", "/bad3", T.raiseInterrupt))
        .do(
          EX.accessApp(app => {
            if (!app) {
              throw new Error("Aborted app not found");
            }
          })
        )
        .do(
          EX.accessAppM(app =>
            T.trySync(() => {
              if (!app) {
                throw new Error("Aborted app not found");
              }
            })
          )
        )
        .bind("s", EX.bind(3003, "127.0.0.1"))
        .return(s => s.s)
    );

    const module = pipe(T.noEnv, T.mergeEnv(EX.express));

    const server = await T.runToPromise(T.provide(module)(program));

    const res = await T.runToPromiseExit(
      pipe(
        T.provide(L.jsonClient)(H.post("http://127.0.0.1:3003/", {})),
        T.chain(s => T.fromOption(() => new Error("empty body"))(s.body))
      )
    );

    const res2 = await T.runToPromiseExit(
      pipe(
        T.provide(L.jsonClient)(H.post("http://127.0.0.1:3003/bad", {})),
        T.mapError(
          s =>
            s._tag === H.HttpErrorReason.Response &&
            s.response &&
            s.response.body
        ),
        T.chain(s => T.fromOption(() => new Error("empty body"))(s.body))
      )
    );

    const res3 = await T.runToPromiseExit(
      pipe(
        T.provide(L.jsonClient)(H.post("http://127.0.0.1:3003/bad2", {})),
        T.mapError(
          s =>
            s._tag === H.HttpErrorReason.Response &&
            s.response &&
            s.response.body
        ),
        T.chain(s => T.fromOption(() => new Error("empty body"))(s.body))
      )
    );

    const res4 = await T.runToPromiseExit(
      pipe(
        T.provide(L.jsonClient)(H.post("http://127.0.0.1:3003/bad3", {})),
        T.mapError(
          s =>
            s._tag === H.HttpErrorReason.Response &&
            s.response &&
            s.response.body
        ),
        T.chain(s => T.fromOption(() => new Error("empty body"))(s.body))
      )
    );

    server.close();

    assert.deepEqual(res, done({ res: 1 }));
    assert.deepEqual(res2, raise(some({ res: 1 })));
    assert.deepEqual(res3, raise(some({ status: "aborted", with: "abort" })));
    assert.deepEqual(res4, raise(some({ status: "interrupted" })));
  });
});
