import * as T from "../_internal/effect"
import * as M from "../_internal/managed"
import { pipe } from "../../Function"
import * as O from "../../Option"
import * as P from "../../Promise"
import { makeBounded } from "../../Queue"
import * as Semaphore from "../../Semaphore"
import * as Pull from "../Pull"
import { Stream } from "./definitions"
import { foreachManaged } from "./foreachManaged"

/**
 * Maps over elements of the stream with the specified effectful function,
 * executing up to `n` invocations of `f` concurrently. Transformed elements
 * will be emitted in the original order.
 */
export const mapMPar = (n: number) => <O, S1, R1, E1, O1>(
  f: (o: O) => T.Effect<S1, R1, E1, O1>
) => <S, R, E>(self: Stream<S, R, E, O>): Stream<unknown, R & R1, E | E1, O1> =>
  new Stream(
    pipe(
      M.of,
      M.bind("out", () =>
        T.toManaged()(makeBounded<T.Effect<unknown, R1, O.Option<E1 | E>, O1>>(n))
      ),
      M.bind("errorSignal", () => T.toManaged()(P.make<E1, never>())),
      M.bind("permits", () => T.toManaged()(Semaphore.makeSemaphore(n))),
      M.tap(({ errorSignal, out, permits }) =>
        pipe(
          self,
          foreachManaged((a) =>
            pipe(
              T.of,
              T.bind("p", () => P.make<E1, O1>()),
              T.bind("latch", () => P.make<never, void>()),
              T.tap(({ p }) => out.offer(pipe(p, P.wait, T.mapError(O.some)))),
              T.tap(({ latch, p }) =>
                pipe(
                  latch,
                  // Make sure we start evaluation before moving on to the next element
                  P.succeed<void>(undefined),
                  T.chain(() =>
                    pipe(
                      errorSignal,
                      P.wait,
                      // Interrupt evaluation if another task fails
                      T.raceFirst(f(a)),
                      // Notify other tasks of a failure
                      T.tapCause((e) => pipe(errorSignal, P.halt(e))),
                      // Transfer the result to the consuming stream
                      T.toPromise(p)
                    )
                  ),
                  Semaphore.withPermit(permits),
                  T.fork
                )
              ),
              T.tap(({ latch }) => P.wait(latch)),
              T.asUnit
            )
          ),
          M.foldCauseM(
            (c) => T.toManaged()(out.offer(Pull.halt(c))),
            () =>
              pipe(
                Semaphore.withPermits(n)(permits)(T.unit),
                T.chain(() => out.offer(Pull.end)),
                T.toManaged()
              )
          ),
          M.fork
        )
      ),
      M.map(({ out }) =>
        pipe(
          out.take,
          T.flatten,
          T.map((o) => [o])
        )
      )
    )
  )
