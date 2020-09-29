import type { Effect } from "."
import { orElse_ } from "./orElse"

/**
 * Returns an effect that ignores errors and runs repeatedly until it eventually succeeds.
 */
export function eventually<R, E, A>(fa: Effect<R, E, A>): Effect<R, E, A> {
  return orElse_(fa, () => eventually(fa))
}
