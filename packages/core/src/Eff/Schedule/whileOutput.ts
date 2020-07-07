import { chain_ } from "../Effect/chain_"
import { Effect } from "../Effect/effect"
import { fail } from "../Effect/fail"
import { succeedNow } from "../Effect/succeedNow"

import { Schedule } from "./schedule"
import { updated_ } from "./updated_"

/**
 * Returns a new schedule that continues the schedule only while the predicate
 * is satisfied on the output value of the schedule.
 */
export const whileOutputM_ = <S, R, ST, A, B, S1, R1>(
  self: Schedule<S, R, ST, A, B>,
  f: (a: B) => Effect<S1, R1, never, boolean>
) =>
  updated_(self, (update) => (a, s) =>
    chain_(f(self.extract(a, s)), (b) => (b ? update(a, s) : fail(undefined)))
  )

/**
 * Returns a new schedule that continues the schedule only while the predicate
 * is satisfied on the output value of the schedule.
 */
export const whileOutputM = <B, S1, R1>(
  f: (a: B) => Effect<S1, R1, never, boolean>
) => <S, R, ST, A>(self: Schedule<S, R, ST, A, B>) => whileOutputM_(self, f)

/**
 * Returns a new schedule that continues the schedule only while the predicate
 * is satisfied on the output value of the schedule.
 */
export const whileOutput_ = <S, R, ST, A, B>(
  self: Schedule<S, R, ST, A, B>,
  f: (a: B) => boolean
) => whileOutputM_(self, (a) => succeedNow(f(a)))

/**
 * Returns a new schedule that continues the schedule only while the predicate
 * is satisfied on the output value of the schedule.
 */
export const whileOutput = <B>(f: (a: B) => boolean) => <S, R, ST, A>(
  self: Schedule<S, R, ST, A, B>
) => whileOutput_(self, f)
