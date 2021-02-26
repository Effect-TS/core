import type { Clock } from "../Clock/definition"
import { pipe } from "../Function"
import type { Has } from "../Has"
import { as } from "./as"
import type { Effect } from "./effect"
import { interruptible } from "./interruptible"
import { map } from "./map"
import { raceFirst } from "./race"
import { sleep } from "./sleep"

/**
 * Returns an effect that will timeout this effect, returning either the
 * default value if the timeout elapses before the effect has produced a
 * value; and or returning the result of applying the function `f` to the
 * success value of the effect.
 *
 * If the timeout elapses without producing a value, the running effect
 * will be safely interrupted
 */
export function timeoutTo<B, B2, A>(d: number, b: B, f: (a: A) => B2) {
  return <R, E>(self: Effect<R, E, A>): Effect<R & Has<Clock>, E, B | B2> =>
    timeoutTo_(self, d, b, f)
}

/**
 * Returns an effect that will timeout this effect, returning either the
 * default value if the timeout elapses before the effect has produced a
 * value; and or returning the result of applying the function `f` to the
 * success value of the effect.
 *
 * If the timeout elapses without producing a value, the running effect
 * will be safely interrupted
 */
export function timeoutTo_<R, E, A, B, B2>(
  self: Effect<R, E, A>,
  d: number,
  b: B,
  f: (a: A) => B2
): Effect<R & Has<Clock>, E, B | B2> {
  return pipe(self, map(f), raceFirst(pipe(sleep(d), interruptible, as(b))))
}
