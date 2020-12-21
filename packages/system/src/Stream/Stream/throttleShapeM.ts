import type * as A from "../../Chunk"
import * as CL from "../../Clock"
import { pipe } from "../../Function"
import * as O from "../../Option"
import * as T from "../_internal/effect"
import * as M from "../_internal/managed"
import * as Ref from "../_internal/ref"
import { Stream } from "./definitions"

/**
 * Delays the chunks of this stream according to the given bandwidth parameters using the token bucket
 * algorithm. Allows for burst in the processing of elements by allowing the token bucket to accumulate
 * tokens up to a `units + burst` threshold. The weight of each chunk is determined by the `costFn`
 * effectful function.
 */
export function throttleShapeM(units: number, duration: number, burst = 0) {
  return <O, R1, E1>(costFn: (c: A.Chunk<O>) => T.Effect<R1, E1, number>) => <R, E>(
    self: Stream<R, E, O>
  ): Stream<CL.HasClock & R1 & R, E | E1, O> => {
    return new Stream(
      pipe(
        M.do,
        M.bind("chunks", () => self.proc),
        M.bind("currentTime", () => T.toManaged_(CL.currentTime)),
        M.bind("bucket", ({ currentTime }) =>
          T.toManaged_(Ref.makeRef([units, currentTime] as const))
        ),
        M.let(
          "pull",
          ({
            bucket,
            chunks
          }): T.Effect<CL.HasClock & R1 & R, O.Option<E | E1>, A.Chunk<O>> =>
            pipe(
              T.do,
              T.bind("chunk", () => chunks),
              T.bind("weight", ({ chunk }) => T.mapError_(costFn(chunk), O.some)),
              T.bind("current", () => CL.currentTime),
              T.bind("delay", ({ current, weight }) =>
                Ref.modify_(bucket, ([tokens, timestamp]) => {
                  const elapsed = current - timestamp
                  const cycles = elapsed / duration
                  const available = (() => {
                    const sum = tokens + cycles * units
                    const max = units + burst < 0 ? Number.MAX_VALUE : units + burst

                    return sum < 0 ? max : Math.min(sum, max)
                  })()

                  const remaining = available - weight
                  const waitCycles = remaining >= 0 ? 0 : -remaining / units
                  const delay = waitCycles * duration

                  return [delay, [remaining, current] as const]
                })
              ),
              T.tap(({ delay }) => T.when_(CL.sleep(delay), () => delay > 0)),
              T.map(({ chunk }) => chunk)
            )
        ),
        M.map(({ pull }) => pull)
      )
    )
  }
}
