import { T } from "@matechs/prelude";
import * as B from "../src";
import { some } from "fp-ts/lib/Option";
import * as M from "@matechs/test-jest";
import { MockStorage } from "./mock";
import { Do } from "fp-ts-contrib/lib/Do";

const browserSpec = M.suite("browser")(
  M.testM(
    "use local storage",
    Do(T.effect)
      .do(B.localStore.setItem("foo", "bar"))
      .bind("l", B.localStore.length)
      .bind("f", B.localStore.getItem("foo"))
      .bind("k", B.localStore.key(0))
      .do(B.localStore.removeItem("foo"))
      .bind("l2", B.localStore.length)
      .do(B.localStore.setItem("foo", "bar"))
      .do(B.localStore.clear)
      .bind("l3", B.localStore.length)
      .return(({ f, k, l, l2, l3 }) => {
        M.assert.deepEqual(l, 1);
        M.assert.deepEqual(k, some("foo"));
        M.assert.deepEqual(f, some("bar"));
        M.assert.deepEqual(l2, 0);
        M.assert.deepEqual(l3, 0);
      })
  ),
  M.testM(
    "use session storage",
    Do(T.effect)
      .do(B.sessionStore.setItem("foo", "bar"))
      .bind("l", B.sessionStore.length)
      .bind("f", B.sessionStore.getItem("foo"))
      .bind("k", B.sessionStore.key(0))
      .do(B.sessionStore.removeItem("foo"))
      .bind("l2", B.sessionStore.length)
      .do(B.sessionStore.setItem("foo", "bar"))
      .do(B.sessionStore.clear)
      .bind("l3", B.sessionStore.length)
      .return(({ f, k, l, l2, l3 }) => {
        M.assert.deepEqual(l, 1);
        M.assert.deepEqual(k, some("foo"));
        M.assert.deepEqual(f, some("bar"));
        M.assert.deepEqual(l2, 0);
        M.assert.deepEqual(l3, 0);
      })
  )
);

const session = new MockStorage([]);
const local = new MockStorage([]);

M.run(browserSpec)(T.provide(B.storageEnv(session, local)));
