import * as T from "../Effect"
import { pipe } from "../Function"
import * as L from "../Persistent/List"
import * as Channel from "./Channel"
import * as Pipeline from "./Pipeline"
import * as S from "./Stream"

export function separate(
  split: string,
  state = ""
): Pipeline.Pipeline<unknown, never, string, string, void> {
  const splits = state.split(split)
  if (splits.length > 1) {
    const newState = splits.pop()!
    return Channel.chain_(S.writeIterable(splits), () => separate(split, newState))
  }
  return Channel.needInput(
    (i: string) => separate(split, state + i),
    () => S.writeIterable(splits)
  )
}

export function group(
  size: number,
  state: L.List<string> = L.empty()
): Pipeline.Pipeline<unknown, never, string, L.List<string>, void> {
  if (state.length === size) {
    return Channel.chain_(S.write(state), () => group(size, L.empty()))
  }
  return Channel.needInput(
    (i: string) => group(size, L.append_(state, i)),
    () => S.write(state)
  )
}

const splitAndGroup = pipe(separate("|"), Pipeline.fuse(group(2)))

pipe(
  S.writeMany("a|b|c", "|d", "e|", "f"),
  Pipeline.fuse(splitAndGroup),
  S.runList,
  T.chain((l) =>
    T.effectTotal(() => {
      console.log(L.toArray(L.map_(l, L.toArray)))
    })
  ),
  T.runPromise
)
