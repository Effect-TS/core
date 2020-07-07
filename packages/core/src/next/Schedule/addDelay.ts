import { succeedNow } from "../Effect/succeedNow"

import { addDelayM_ } from "./addDelayM_"
import { Schedule } from "./schedule"

/**
 * Returns a new schedule with the given delay added to every update.
 */
export const addDelay = <S, R, ST, A, B>(f: (b: B) => number) => (
  self: Schedule<S, R, ST, A, B>
) => addDelayM_(self, (b) => succeedNow(f(b)))
