import * as T from "../../src/Effect"
import * as Ex from "../../src/Exit"
import * as F from "../../src/Fiber"
import { pipe } from "../../src/Function"
import * as Ta from "../../src/Testing/TestAnnotation"
import { Duration, TestClock } from "../../src/Testing/TestClock"
import { TestEnvironment } from "../../src/Testing/TestEnvironment"

it("test env", async () => {
  const res = await pipe(
    T.gen(function* (_) {
      const TC = yield* _(TestClock)

      const sleeping = yield* _(T.fork(T.sleep(10_000)))

      yield* _(TC.adjust(Duration(10_000)))

      return yield* _(F.join(sleeping))
    }),
    Ta.fibersPerTest,
    T.provideLayer(TestEnvironment),
    T.runPromiseExit
  )

  expect(res).equals(Ex.unit)
})
