import { pipe } from "../../Function"
import * as T from "../Effect"
import * as S from "../Schedule"

let i = 0

const policy = pipe(
  S.id<number>(),
  S.addDelay(() => 1000)
)

const program = pipe(
  T.suspend(() => {
    i += 1
    const r = Math.random()
    return r > 0.1 ? T.fail(r) : T.succeedNow(i)
  }),
  T.retry(policy),
  T.chain((n) =>
    T.effectTotal(() => {
      console.log(n)
    })
  )
)

T.runMain(program)
