import { effect as T, freeEnv as F } from "@matechs/effect";
import * as M from "@matechs/test-jest";
import * as A from "fp-ts/lib/Array";
import { pipe } from "fp-ts/lib/pipeable";
import * as P from "../src";
import Pino from "pino";
import * as L from "@matechs/logger";

// tslint:disable-next-line: no-empty
const empty = () => {};

type PinoLoggedObject<T extends object> = T & {
  level: number;
  time: number;
  pid: number;
  hostname: string;
  msg: string;
};

const checkLevel = <O extends object>(
  calls: PinoLoggedObject<O>[],
  level: Pino.Level,
  expected: (O & { msg: string })[]
) =>
  T.sync(() =>
    pipe(
      calls,
      A.filter((c) => c.level === Pino.levels.values[level]),
      A.map(({ hostname, level, pid, time, msg, ...rest }) => ({ msg, ...rest })),
      (fatal) => {
        M.assert.deepEqual(fatal, expected);
      }
    )
  );

const pinoLoggerSpec = M.suite("Pino")(
  M.mockedTestM("use pino logger instance")(() => ({ write: jest.fn<void, [string]>(empty) }))(
    ({ useMockM }) =>
      pipe(
        T.Do()
          .do(P.fatal({ foo: "bar" }, "msg"))
          .do(P.fatal({ foo: "bar" }, "msg"))
          .do(P.error({ foo: "bar" }, "msg"))
          .do(P.warn({ foo: "bar" }, "msg"))
          .do(P.info({ foo: "bar" }, "msg"))
          .do(P.debug({ foo: "bar" }, "msg"))
          .do(P.trace({ foo: "bar" }, "msg"))
          .do(P.fatal("msg"))
          .do(P.error("msg"))
          .do(P.warn("msg"))
          .do(P.info("msg"))
          .do(P.debug("msg"))
          .do(P.trace("msg"))
          .bind(
            "calls",
            useMockM(({ write }) =>
              pipe(
                write.mock.calls,
                A.map(([str]): PinoLoggedObject<{ foo?: string }> => JSON.parse(str)),
                T.pure
              )
            )
          )
          .sequenceSL(({ calls }) => ({
            len: T.sync(() => {
              M.assert.strictEqual(calls.length, 13);
            }),
            fatal: checkLevel(calls, "fatal", [
              { msg: "msg", foo: "bar" },
              { msg: "msg", foo: "bar" },
              { msg: "msg" }
            ]),
            error: checkLevel(calls, "error", [{ msg: "msg", foo: "bar" }, { msg: "msg" }]),
            warn: checkLevel(calls, "warn", [{ msg: "msg", foo: "bar" }, { msg: "msg" }]),
            info: checkLevel(calls, "info", [{ msg: "msg", foo: "bar" }, { msg: "msg" }]),
            debug: checkLevel(calls, "debug", [{ msg: "msg", foo: "bar" }, { msg: "msg" }]),
            trace: checkLevel(calls, "trace", [{ msg: "msg", foo: "bar" }, { msg: "msg" }])
          }))
          .done(),
        F.implementWith(useMockM(({ write }) => T.sync(() => Pino({ level: "trace" }, { write }))))(
          P.pinoInstanceM
        )((logger) => ({ [P.PinoInstanceURI]: { logger: T.pure(logger) } }))
      )
  ),
  M.mockedTestM("use @matechs/logger instance")(() => ({ write: jest.fn<void, [string]>(empty) }))(
    ({ useMockM }) =>
      pipe(
        T.Do()
          .do(L.logger.info("ok"))
          .do(L.logger.http("ok"))
          .do(L.logger.debug("ok"))
          .do(L.logger.silly("ok"))
          .do(L.logger.verbose("ok"))
          .do(L.logger.warn("ok"))
          .do(L.logger.error("ok"))
          .do(L.logger.error("ok", { foo: "ok" }))
          .bind(
            "calls",
            useMockM(({ write }) =>
              pipe(
                write.mock.calls,
                A.map(([str]): PinoLoggedObject<{ foo?: string }> => JSON.parse(str)),
                T.pure
              )
            )
          )
          .sequenceSL(({ calls }) => ({
            len: T.sync(() => {
              M.assert.strictEqual(calls.length, 8);
            }),
            fatal: checkLevel(calls, "fatal", []),
            error: checkLevel(calls, "error", [{ msg: "ok" }, { msg: "ok", foo: "ok" }]),
            warn: checkLevel(calls, "warn", [{ msg: "ok" }]),
            info: checkLevel(calls, "info", [{ msg: "ok" }, { msg: "ok" }, { msg: "ok" }]),
            debug: checkLevel(calls, "debug", [{ msg: "ok" }]),
            trace: checkLevel(calls, "trace", [{ msg: "ok" }])
          }))
          .done(),
        P.providePinoLogger,
        F.implementWith(useMockM(({ write }) => T.sync(() => Pino({ level: "trace" }, { write }))))(
          P.pinoInstanceM
        )((logger) => ({ [P.PinoInstanceURI]: { logger: T.pure(logger) } }))
      )
  ),
  pipe(
    M.testM("provides instance", T.Do().do(P.info("ok")).done()),
    M.withProvider(P.providePino({}, { write: empty }))
  )
);

M.run(pinoLoggerSpec)();
