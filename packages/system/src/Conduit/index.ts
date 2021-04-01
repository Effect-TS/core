import * as T from "../Effect"
import { pipe } from "../Function"
import * as L from "../Persistent/List"
import * as S from "./Stream"

console.time("stream")

const stream = pipe(
  S.iterate(1, (n) => n + 1),
  S.takeN(2),
  S.chain((n) =>
    pipe(
      S.iterate(n, (n) => n + 1),
      S.takeN(3)
    )
  )
)

pipe(
  stream,
  S.runList,
  T.chain((l) =>
    T.effectTotal(() => {
      console.log(L.size(l))
      console.log(L.toArray(l))
    })
  ),
  T.runPromise
).then(() => console.timeEnd("stream"))
