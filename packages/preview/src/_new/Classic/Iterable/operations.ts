import { pipe } from "../../../_system/Function"
import { reduce, of, never, concat } from "../../../_system/Iterable"
import * as P from "../../Prelude"

import { IterableURI } from "./definitions"

export {
  ap,
  chain,
  chain_,
  concat,
  flatten,
  foldMap,
  map,
  map_,
  never,
  of,
  reduce,
  reduce_,
  reduceRight,
  reduceRight_,
  zip,
  zip_
} from "../../../_system/Iterable"

export const foreachF = P.implementForeachF<IterableURI>()((_) => (G) => (f) =>
  reduce(
    pipe(
      G.any(),
      G.map(() => never as Iterable<typeof _.B>)
    ),
    (b, a) =>
      pipe(
        b,
        G.both(f(a)),
        G.map(([x, y]) => concat(x, of(y)))
      )
  )
)
