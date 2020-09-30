import type * as E from "../Either"
import type { FiberID } from "../Fiber/id"
import * as O from "../Option"
import { AtomicReference } from "../Support/AtomicReference"
import { OneShot } from "../Support/OneShot"
import type { Canceler } from "./Canceler"
import type { Cb } from "./Cb"
import { chain_, effectAsyncOption, effectTotal, succeed, suspend, unit } from "./core"
import type { Effect, UIO } from "./effect"
import { flatten } from "./flatten"
import { onInterrupt_ } from "./onInterrupt_"

/**
 * Imports an asynchronous side-effect into an effect. The side-effect
 * has the option of returning the value synchronously, which is useful in
 * cases where it cannot be determined if the effect is synchronous or
 * asynchronous until the side-effect is actually executed. The effect also
 * has the option of returning a canceler, which will be used by the runtime
 * to cancel the asynchronous effect if the fiber executing the effect is
 * interrupted.
 *
 * If the register function returns a value synchronously, then the callback
 * function must not be called. Otherwise the callback function must be called
 * at most once.
 *
 * The list of fibers, that may complete the async callback, is used to
 * provide better diagnostics.
 */
export function effectMaybeAsyncInterrupt<R, E, A>(
  register: (cb: Cb<Effect<R, E, A>>) => E.Either<Canceler<R>, Effect<R, E, A>>,
  blockingOn: readonly FiberID[] = []
) {
  return chain_(
    effectTotal(
      () => [new AtomicReference(false), new OneShot<Canceler<R>>()] as const
    ),
    ([started, cancel]) =>
      onInterrupt_(
        flatten(
          effectAsyncOption<R, E, Effect<R, E, A>>((k) => {
            started.set(true)

            const ret = new AtomicReference<O.Option<UIO<Effect<R, E, A>>>>(O.none)

            try {
              const res = register((io) => k(succeed(io)))

              switch (res._tag) {
                case "Right": {
                  ret.set(O.some(succeed(res.right)))
                  break
                }
                case "Left": {
                  cancel.set(res.left)
                  break
                }
              }
            } finally {
              if (!cancel.isSet()) {
                cancel.set(unit)
              }
            }

            return ret.get
          }, blockingOn)
        ),
        () => suspend(() => (started.get ? cancel.get() : unit))
      )
  )
}
