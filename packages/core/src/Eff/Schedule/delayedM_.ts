import { HasClock, ProxyClock } from "../Clock"
import { chain_ } from "../Effect/chain_"
import { AsyncR } from "../Effect/effect"
import { environment } from "../Effect/environment"
import { Do } from "../Effect/instances"
import { map_ } from "../Effect/map_"
import { provideAll_ } from "../Effect/provideAll_"
import { replaceServiceIn_ } from "../Has"

import { Schedule } from "./schedule"

/**
 * Returns a new schedule with the specified effectful modification
 * applied to each delay produced by this schedule.
 */
export const delayedM_ = <S, A, B, ST, R = unknown, R0 = unknown>(
  self: Schedule<S, R & HasClock, ST, A, B>,
  f: (ms: number) => AsyncR<R0, number>
): Schedule<S, R & R0 & HasClock, [ST, R0 & R & HasClock], A, B> => {
  return new Schedule(
    Do()
      .bind("oldEnv", environment<R0 & R & HasClock>())
      .letL("env", (s): R0 & R & HasClock =>
        replaceServiceIn_(
          s.oldEnv,
          HasClock,
          (c) =>
            new ProxyClock(c.currentTime, (ms) =>
              provideAll_(
                chain_(f(ms), (n) => c.sleep(n)),
                s.oldEnv
              )
            )
        )
      )
      .bindL("initial", (s) => provideAll_(self.initial, s.env))
      .return((s): [ST, R0 & R & HasClock] => [s.initial, s.env]),
    (a: A, s: [ST, R0 & R & HasClock]) =>
      map_(provideAll_(self.update(a, s[0]), s[1]), (_): [ST, R0 & R & HasClock] => [
        _,
        s[1]
      ]),
    (a: A, s: [ST, R0 & R & HasClock]) => self.extract(a, s[0])
  )
}
