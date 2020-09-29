import type { Cause } from "../Cause/cause"
import type { Effect } from "./effect"
import { tapCause_ } from "./tapCause_"

/**
 * Returns an effect that effectually "peeks" at the cause of the failure of
 * this effect.
 */
export function tapCause<R, E, E2>(f: (e: Cause<E2>) => Effect<R, E, any>) {
  return <R2, A2>(effect: Effect<R2, E2, A2>) => tapCause_(effect, f)
}
