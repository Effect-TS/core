import { pretty } from "../Cause"
import * as T from "../Effect"
import { pipe } from "../Function"
import { tag } from "../Has"
import * as I from "../Iterable"
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
  S.write(1),
  S.chain((x) => S.writeIterable(I.unfold(x, (n) => n + 1))),
  S.takeN(2),
  S.chain((n) =>
    pipe(
      S.writeIterate(n, (n) => n + 1),
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