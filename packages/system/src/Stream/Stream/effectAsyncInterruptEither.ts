import type * as A from "../../Array/core"
import * as E from "../../Either"
import type * as Ex from "../../Exit"
import { pipe } from "../../Function"
import type * as O from "../../Option"
import * as Q from "../../Queue"
import * as T from "../_internal/effect"
import type * as F from "../_internal/fiber"
import * as M from "../_internal/managed"
import * as Ref from "../_internal/ref"
import * as Pull from "../Pull"
import * as Take from "../Take"
import { Stream } from "./definitions"

/**
 * Creates a stream from an asynchronous callback that can be called multiple times.
 * The registration of the callback returns either a canceler or synchronously returns a stream.
 * The optionality of the error type `E` can be used to signal the end of the stream, by
 * setting it to `None`.
 */
export function effectAsyncInterruptEither<R, E, A>(
  register: (
    cb: (
      next: T.Effect<R, O.Option<E>, A.Array<A>>,
      offerCb?: F.Callback<never, boolean>
    ) => T.UIO<Ex.Exit<never, boolean>>
  ) => E.Either<T.Canceler<R>, Stream<R, E, A>>,
  outputBuffer = 16
): Stream<R, E, A> {
  return new Stream(
    pipe(
      M.do,
      M.bind("output", () =>
        pipe(Q.makeBounded<Take.Take<E, A>>(outputBuffer), T.toManaged())
      ),
      M.bind("runtime", () => pipe(T.runtime<R>(), T.toManaged())),
      M.bind("eitherStream", ({ output, runtime }) =>
        M.effectTotal(() =>
          register((k, cb) =>
            pipe(Take.fromPull(k), T.chain(output.offer), (x) =>
              runtime.runCancel(x, cb)
            )
          )
        )
      ),
      M.bind("pull", ({ eitherStream, output }) =>
        E.fold_(
          eitherStream,
          (canceler) =>
            pipe(
              M.do,
              M.bind("done", () => Ref.makeManagedRef(false)),
              M.map(({ done }) =>
                pipe(
                  done.get,
                  T.chain((b) =>
                    b
                      ? Pull.end
                      : pipe(
                          output.take,
                          T.chain(Take.done),
                          T.onError(() =>
                            pipe(
                              done.set(true),
                              T.chain(() => output.shutdown)
                            )
                          )
                        )
                  )
                )
              ),
              M.ensuring(canceler)
            ),
          (s) =>
            pipe(
              output.shutdown,
              T.toManaged(),
              M.chain(() => s.proc)
            )
        )
      ),
      M.map(({ pull }) => pull)
    )
  )
}
