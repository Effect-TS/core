import { pretty } from "../Cause"
import * as T from "../Effect"
import { pipe } from "../Function"
import { tag } from "../Has"
import * as M from "../Managed"
import * as L from "../Persistent/List"
import * as S from "./Stream"

const MapServiceTypeId = Symbol()

interface MapService {
  readonly _typeId: typeof MapServiceTypeId
  readonly augment: (s: string) => T.UIO<string>
}

const MapService = tag<MapService>()

const { augment } = T.deriveLifted(MapService)(["augment"], [], [])

console.time("stream")

const stream = pipe(
  S.fromManaged(
    M.makeExit_(
      T.effectTotal(() => {
        console.log("open")
        return 1
      }),
      () =>
        T.effectTotal(() => {
          console.log("close")
        })
    )
  ),
  S.chain((x) => S.iterate(x, (n) => n + 1)),
  S.takeN(2),
  S.chain((n) =>
    pipe(
      S.iterate(n, (n) => {
        throw "ok"
        return n + 1
      }),
      S.takeN(3)
    )
  ),
  S.map((n) => `(${n})`),
  S.mapEffect(augment)
)

pipe(
  stream,
  S.runList,
  T.chain((l) =>
    T.effectTotal(() => {
      console.log(L.toArray(l))
    })
  ),
  T.provideService(MapService)({
    _typeId: MapServiceTypeId,
    augment: (s) =>
      T.effectTotal(() => {
        console.log("augument")
        return `[${s}]`
      })
  }),
  T.runPromiseExit
).then((x) => {
  console.timeEnd("stream")
  if (x._tag === "Failure") {
    console.log(pretty(x.cause))
  }
})
