import { testM, run, suite, mockedTestM, expect } from "../src"

import * as T from "@matechs/core/Effect"
import { Empty } from "@matechs/core/Layer"

run(
  testM(
    "simple root",
    T.sync(() => expect(2).toBe(2))
  )
)(Empty.use)

run(
  suite("jest mock")(
    mockedTestM("test using mocked console")(
      T.sync(() => ({
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        info: jest.spyOn(console, "info").mockImplementation(() => {})
      }))
    )(({ useMockM }) =>
      T.Do()
        .do(
          T.sync(() => {
            console.info("ok")
          })
        )
        .do(
          useMockM(({ info }) =>
            T.sync(() => {
              expect(info.mock.calls).toEqual([["ok"]])
            })
          )
        )
        .done()
    )
  )
)(Empty.use)
