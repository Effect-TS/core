import { Clock } from "../Clock"
import { AsyncR } from "../Effect/effect"

import { delayedM_ } from "./delayedM_"
import { Schedule } from "./schedule"

/**
 * Returns a new schedule with the specified effectful modification
 * applied to each delay produced by this schedule.
 */
export const delayedM = <R0 = unknown>(f: (ms: number) => AsyncR<R0, number>) => <
  S,
  A,
  B,
  R = unknown
>(
  self: Schedule<S, R & Clock, A, B>
) => delayedM_(self, f)
