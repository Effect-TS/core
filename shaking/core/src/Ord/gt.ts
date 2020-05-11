import type { Ord } from "./Ord"

/**
 * Test whether one value is _strictly greater than_ another
 *
 * @since 2.0.0
 */
export function gt<A>(O: Ord<A>): (x: A, y: A) => boolean {
  return (x, y) => O.compare(x, y) === 1
}
