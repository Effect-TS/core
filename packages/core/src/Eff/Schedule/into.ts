import { Do } from "../Effect/instances"
import { zip_ } from "../Effect/zip_"

import { Schedule, ScheduleClass } from "./schedule"

/**
 * Returns the composition of this schedule and the specified schedule,
 * by piping the output of this one into the input of the other.
 * Effects described by this schedule will always be executed before the effects described by the second schedule.
 */
export const into_ = <S, R, A, B, S2, R2, C>(
  self: Schedule<S, R, A, B>,
  that: Schedule<S2, R2, B, C>
) =>
  new ScheduleClass<S | S2, R & R2, [any, any], A, C>(
    zip_(self.initial, that.initial),
    (a, s) =>
      Do()
        .bind("s1", self.update(a, s[0]))
        .bind("s2", that.update(self.extract(a, s[0]), s[1]))
        .return((s) => [s.s1, s.s2]),
    (a, s) => that.extract(self.extract(a, s[0]), s[1])
  )

/**
 * Returns the composition of this schedule and the specified schedule,
 * by piping the output of this one into the input of the other.
 * Effects described by this schedule will always be executed before the effects described by the second schedule.
 */
export const into = <S2, R2, B, C>(that: Schedule<S2, R2, B, C>) => <S, R, A>(
  self: Schedule<S, R, A, B>
) => into_(self, that)
