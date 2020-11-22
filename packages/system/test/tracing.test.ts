// trace: on
// tracingModule: ../src/Tracing

import * as T from "../src/Effect"
import { identity, pipe } from "../src/Function"
import * as O from "../src/Option"
import { foldTraced_ } from "../src/Tracing"
import { CustomService, makeCustomService } from "./utils/service"

describe("Tracer", () => {
  it("trace", async () => {
    const aliasedSucceed = T.succeed
    const traces = await pipe(
      T.tuple(aliasedSucceed(1), aliasedSucceed(2), aliasedSucceed(3)),
      T.map(([a, b, c]) => a + b + c),
      T.bimap(identity, (n) => n + 1),
      T.andThen(T.checkExecutionTraces(T.succeed)),
      T.runPromise
    )

    expect(traces).toEqual([
      "packages/system/test/tracing.test.ts:14:14:Effect:tuple",
      "packages/system/test/tracing.test.ts:14:30:Effect:succeed",
      "packages/system/test/tracing.test.ts:14:49:Effect:succeed",
      "packages/system/test/tracing.test.ts:14:68:Effect:succeed",
      "packages/system/test/tracing.test.ts:15:13:Effect:map",
      "packages/system/test/tracing.test.ts:16:25:Effect:bimap",
      "packages/system/test/tracing.test.ts:17:17:Effect:andThen",
      "packages/system/test/tracing.test.ts:17:40:Effect:checkExecutionTraces"
    ])
  })

  it("trace generatorM", async () => {
    const traces = await T.runPromise(
      T.genM(function* ($) {
        const a = yield* $(T.succeed(1))
        const b = yield* $(T.succeed(2))
        yield* $(T.effectTotal(() => a + b))
        return yield* $(T.checkExecutionTraces(T.succeed))
      })
    )

    expect(traces).toEqual([
      "packages/system/test/tracing.test.ts:36:26:Effect:bind",
      "packages/system/test/tracing.test.ts:36:38:Effect:succeed",
      "packages/system/test/tracing.test.ts:37:26:Effect:bind",
      "packages/system/test/tracing.test.ts:37:38:Effect:succeed",
      "packages/system/test/tracing.test.ts:38:16:Effect:bind",
      "packages/system/test/tracing.test.ts:38:32:Effect:effectTotal",
      "packages/system/test/tracing.test.ts:39:23:Effect:bind",
      "packages/system/test/tracing.test.ts:39:48:Effect:checkExecutionTraces"
    ])
  })

  it("trace generator", async () => {
    const traces = await T.runPromise(
      T.gen(function* ($) {
        const a = yield* $(T.succeed(1))
        const b = yield* $(T.succeed(2))
        yield* $(T.effectTotal(() => a + b))
        return yield* $(T.checkExecutionTraces(T.succeed))
      })
    )

    expect(traces).toEqual([
      "packages/system/test/tracing.test.ts:58:26:Effect:bind",
      "packages/system/test/tracing.test.ts:58:38:Effect:succeed",
      "packages/system/test/tracing.test.ts:59:26:Effect:bind",
      "packages/system/test/tracing.test.ts:59:38:Effect:succeed",
      "packages/system/test/tracing.test.ts:60:16:Effect:bind",
      "packages/system/test/tracing.test.ts:60:32:Effect:effectTotal",
      "packages/system/test/tracing.test.ts:61:23:Effect:bind",
      "packages/system/test/tracing.test.ts:61:48:Effect:checkExecutionTraces"
    ])
  })

  it("trace service", async () => {
    const traces = await pipe(
      T.accessServiceM(CustomService)((_) => _.printTrace(1)),
      T.andThen(T.checkExecutionTraces(T.succeed)),
      T.provideServiceM(CustomService)(makeCustomService),
      T.runPromise
    )

    expect(traces).toEqual([
      "packages/system/test/utils/service.ts:12:14:CustomService:makeCustomService",
      "packages/system/test/utils/service.ts:12:44:Effect:succeed",
      "packages/system/test/tracing.test.ts:79:39:Effect:accessServiceM",
      "packages/system/test/tracing.test.ts:79:58:CustomService:printTrace",
      "packages/system/test/utils/service.ts:18:29:Effect:chain_",
      "packages/system/test/utils/service.ts:18:45:Effect:succeed",
      "packages/system/test/tracing.test.ts:80:17:Effect:andThen",
      "packages/system/test/tracing.test.ts:80:40:Effect:checkExecutionTraces"
    ])
  })

  it("should embed trace", () => {
    /**
     * @module Custom
     * @trace replace 0
     */
    function custom(n: number): O.Option<string> {
      return foldTraced_(n, (_, trace) => O.fromNullable(trace))
    }

    const call = custom(1)

    expect(call).toEqual(
      O.some("packages/system/test/tracing.test.ts:106:25:Custom:custom")
    )
  })

  it("should trace fork", async () => {
    const traces = await pipe(
      T.fork(T.sleep(200)),
      T.andThen(T.checkExecutionTraces(T.succeed)),
      T.runPromise
    )

    expect(traces).toEqual([
      "packages/system/test/tracing.test.ts:115:14:Effect:fork",
      "packages/system/test/tracing.test.ts:116:17:Effect:andThen",
      "packages/system/test/tracing.test.ts:116:40:Effect:checkExecutionTraces"
    ])
  })

  it("should trace sleep", async () => {
    const traces = await pipe(
      T.sleep(200),
      T.andThen(T.checkExecutionTraces(T.succeed)),
      T.runPromise
    )

    expect(traces).toEqual([
      "packages/system/test/tracing.test.ts:129:15:Effect:sleep",
      "packages/system/test/tracing.test.ts:130:17:Effect:andThen",
      "packages/system/test/tracing.test.ts:130:40:Effect:checkExecutionTraces"
    ])
  })

  it("should trace point free", async () => {
    const traces = await pipe(
      200,
      T.sleep,
      T.andThen(T.checkExecutionTraces(T.succeed)),
      T.runPromise
    )

    expect(traces).toEqual([
      "packages/system/test/tracing.test.ts:144:14:Effect:sleep",
      "packages/system/test/tracing.test.ts:145:17:Effect:andThen",
      "packages/system/test/tracing.test.ts:145:40:Effect:checkExecutionTraces"
    ])
  })
})
