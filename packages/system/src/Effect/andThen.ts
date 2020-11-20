import { chain_ } from "./core"
import type { Effect } from "./effect"

/**
 * Like chain but ignores the input
 */
export function andThen<R1, E1, A1>(fb: Effect<R1, E1, A1>) {
  return <R, E, A>(fa: Effect<R, E, A>) => andThen_(fa, fb)
}

/**
 * Like chain but ignores the input
 */
export function andThen_<R, E, A, R1, E1, A1>(
  fa: Effect<R, E, A>,
  fb: Effect<R1, E1, A1>
) {
  return chain_(fa, () => fb)
}
