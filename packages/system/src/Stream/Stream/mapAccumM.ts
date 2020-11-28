import { pipe } from "../../Function"
import * as Option from "../../Option"
import * as Ref from "../../Ref"
import * as T from "../_internal/effect"
import * as M from "../_internal/managed"
import * as BPull from "../BufferedPull"
import { Stream } from "./definitions"

/**
 * Statefully and effectfully maps over the elements of this stream to produce
 * new elements.
 */
export function mapAccumM<Z>(z: Z) {
  return <O, R1, E1, O1>(f: (z: Z, o: O) => T.Effect<R1, E1, [Z, O1]>) => <R, E>(
    self: Stream<R, E, O>
  ) =>
    new Stream<R & R1, E | E1, O1>(
      pipe(
        M.do,
        M.bind("state", () => Ref.makeManagedRef(z)),
        M.bind("pull", () => pipe(self.proc, M.mapM(BPull.make))),
        M.map(({ pull, state }) =>
          pipe(
            pull,
            BPull.pullElement,
            T.chain((o) =>
              pipe(
                T.do,
                T.bind("s", () => state.get),
                T.bind("t", ({ s }) => f(s, o)),
                T.tap(({ t }) => state.set(t[0])),
                T.map(({ t }) => [t[1]]),
                T.mapError(Option.some)
              )
            )
          )
        )
      )
    )
}
