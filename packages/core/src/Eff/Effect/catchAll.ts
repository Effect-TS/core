import { Effect } from "./effect"
import { foldM_ } from "./foldM_"
import { succeedNow } from "./succeedNow"

/**
 * Recovers from all errors.
 */
export const catchAll = <S, R, E, A>(f: () => Effect<S, R, E, A>) => <S2, R2, E2, A2>(
  effect: Effect<S2, R2, E2, A2>
) => foldM_(effect, f, (x) => succeedNow(x))
