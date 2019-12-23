import { effect as T } from "@matechs/effect";
import * as H from "@matechs/http-client";
import assert from "assert";
import bodyParser from "body-parser";
import express from "express";
import { jsonClient } from "../src";
import { pipe } from "fp-ts/lib/pipeable";
import { isDone, isRaise, isInterrupt } from "@matechs/effect/lib/exit";
import { Exit } from "@matechs/effect/lib/original/exit";
import { some } from "fp-ts/lib/Option";

function run<E, A>(eff: T.Effect<H.RequestEnv, E, A>): Promise<Exit<E, A>> {
  return T.runToPromiseExit(
    pipe(
      eff,
      T.provide(jsonClient),
      T.provide(
        H.middlewareStack([
          H.withPathHeaders(
            { foo: "bar" },
            path => path === "http://127.0.0.1:4005/middle",
            true
          )
        ])
      )
    )
  );
}

describe("Libcurl", () => {
  it("post-patch-put-del", async () => {
    const app = express();

    app.post("/post", bodyParser.json(), (req, res) => {
      res.send(req.body);
    });

    app.put("/put", bodyParser.json(), (req, res) => {
      res.send(req.body);
    });

    app.patch("/patch", bodyParser.json(), (req, res) => {
      res.send(req.body);
    });

    app.delete("/delete", bodyParser.json(), (req, res) => {
      res.send(req.body);
    });

    const s = app.listen(4001);

    const post = await run(
      H.post("http://127.0.0.1:4001/post", {
        foo: "bar"
      })
    );

    const postText = await run(
      H.text(
        H.post("http://127.0.0.1:4001/post", {
          foo: "bar"
        })
      )
    );

    const postNoBody = await run(H.post("http://127.0.0.1:4001/post"));

    const put = await run(
      H.put("http://127.0.0.1:4001/put", {
        foo: "bar"
      })
    );

    const patch = await run(
      H.patch("http://127.0.0.1:4001/patch", {
        foo: "bar"
      })
    );

    const del = await run(
      H.del("http://127.0.0.1:4001/delete", {
        foo: "bar"
      })
    );

    s.close();

    assert.deepEqual(isDone(post), true);
    assert.deepEqual(isDone(post) && post.value.body, some({ foo: "bar" }));

    assert.deepEqual(isDone(postText), true);
    assert.deepEqual(
      isDone(postText) && postText.value.body,
      some(JSON.stringify({ foo: "bar" }))
    );

    assert.deepEqual(isDone(postNoBody), true);
    assert.deepEqual(isDone(postNoBody) && postNoBody.value.body, some({}));

    assert.deepEqual(isDone(put), true);
    assert.deepEqual(isDone(put) && put.value.body, some({ foo: "bar" }));

    assert.deepEqual(isDone(patch), true);
    assert.deepEqual(isDone(patch) && patch.value.body, some({ foo: "bar" }));

    assert.deepEqual(isDone(del), true);
    assert.deepEqual(isDone(del) && del.value.body, some({ foo: "bar" }));
  });

  it("get 404", async () => {
    const app = express();

    const s = app.listen(4001);

    const result = await run(
      pipe(
        H.get("http://127.0.0.1:4001/"),
        T.mapError(
          H.foldHttpError(
            _ => 0,
            ({ status }) => status
          )
        )
      )
    );

    s.close();

    assert.deepEqual(isRaise(result), true);
    assert.deepEqual(isRaise(result) && result.error, 404);
  });

  it("headers", async () => {
    const app = express();

    app.get("/h", bodyParser.json(), (req, res) => {
      res.send({
        foo: req.header("foo")
      });
    });

    const s = app.listen(4002);

    const result = await run(
      pipe(
        H.get<unknown, { foo: string }>("http://127.0.0.1:4002/h"),
        H.withHeaders({
          foo: "bar"
        })
      )
    );

    s.close();

    assert.deepEqual(isDone(result), true);
    assert.deepEqual(isDone(result) && result.value.body, some({ foo: "bar" }));
  });

  it("headers middleware", async () => {
    const app = express();

    app.get("/middle", bodyParser.json(), (req, res) => {
      res.send({
        foo: req.header("foo")
      });
    });

    const s = app.listen(4005);

    const result = await run(
      pipe(H.get<unknown, { foo: string }>("http://127.0.0.1:4005/middle"))
    );

    s.close();

    assert.deepEqual(isDone(result), true);
    assert.deepEqual(isDone(result) && result.value.body, some({ foo: "bar" }));
  });

  it("replace headers", async () => {
    const app = express();

    app.get("/h", bodyParser.json(), (req, res) => {
      res.send({
        foo: req.header("foo"),
        bar: req.header("bar")
      });
    });

    const s = app.listen(4004);

    const result = await run(
      pipe(
        H.get<unknown, { foo: string; bar?: string }>(
          "http://127.0.0.1:4004/h"
        ),
        H.withHeaders(
          {
            foo: "baz"
          },
          true
        ),
        H.withHeaders({
          foo: "bar",
          bar: "baz"
        })
      )
    );

    s.close();

    assert.deepEqual(isDone(result), true);
    assert.deepEqual(isDone(result) && result.value.body, some({ foo: "baz" }));
  });

  it("data", async () => {
    const app = express();

    app.use("/data", bodyParser.urlencoded({ extended: true }), (req, res) => {
      res.send({
        foo: req.body["foo"]
      });
    });

    const s = app.listen(4003);

    const post: Exit<
      H.HttpError<unknown>,
      H.Response<{ foo: string }>
    > = await run(
      pipe(H.postData("http://127.0.0.1:4003/data", { foo: "bar" }))
    );

    const put: Exit<
      H.HttpError<unknown>,
      H.Response<{ foo: string }>
    > = await run(
      pipe(H.putData("http://127.0.0.1:4003/data", { foo: "bar" }))
    );

    const patch: Exit<
      H.HttpError<unknown>,
      H.Response<{ foo: string }>
    > = await run(
      pipe(H.patchData("http://127.0.0.1:4003/data", { foo: "bar" }))
    );

    const del: Exit<
      H.HttpError<unknown>,
      H.Response<{ foo: string }>
    > = await run(
      pipe(H.delData("http://127.0.0.1:4003/data", { foo: "bar" }))
    );

    s.close();

    assert.deepEqual(isDone(post), true);
    assert.deepEqual(isDone(post) && post.value.body, some({ foo: "bar" }));

    assert.deepEqual(isDone(put), true);
    assert.deepEqual(isDone(put) && put.value.body, some({ foo: "bar" }));

    assert.deepEqual(isDone(patch), true);
    assert.deepEqual(isDone(patch) && patch.value.body, some({ foo: "bar" }));

    assert.deepEqual(isDone(del), true);
    assert.deepEqual(isDone(del) && del.value.body, some({ foo: "bar" }));
  });

  it("get https", async () => {
    const result = await run(
      H.get("https://jsonplaceholder.typicode.com/todos/1")
    );

    assert.deepEqual(isDone(result), true);
    assert.deepEqual(
      isDone(result) && result.value.body,
      some({
        userId: 1,
        id: 1,
        title: "delectus aut autem",
        completed: false
      })
    );
  });

  it("malformed", async () => {
    const result = await run(H.get("ht-ps://wrong.com/todos/1"));

    assert.deepEqual(isRaise(result), true);
    assert.deepEqual(
      isRaise(result) &&
        result.error._tag === H.HttpErrorReason.Request &&
        result.error.error,
      new Error("Unsupported protocol")
    );
  });

  it("cancel", async () => {
    let res;

    const cancel = T.run(
      pipe(
        H.get("https://jsonplaceholder.typicode.com/todos/1"),
        T.provideAll(jsonClient)
      ),
      r => {
        res = r;
      }
    );

    cancel();

    assert.deepEqual(res && isInterrupt(res), true);
  });
});
