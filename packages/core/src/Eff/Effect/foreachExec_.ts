import { ExecutionStrategy, Sequential, Parallel, ParallelN } from "./ExecutionStrategy"
import { Effect } from "./effect"
import { foreachParN_ } from "./foreachParN_"
import { foreachPar_ } from "./foreachPar_"
import { foreach_ } from "./foreach_"

/**
 * Applies the function `f` to each element of the `Iterable<A>` in parallel,
 * and returns the results in a new `readonly B[]`.
 *
 * For a sequential version of this method, see `foreach`.
 */
export function foreachExec_<S, R, E, A, B>(
  es: Sequential,
  as: Iterable<A>,
  f: (a: A) => Effect<S, R, E, B>
): Effect<never, R, E, readonly B[]>
export function foreachExec_<S, R, E, A, B>(
  es: Parallel,
  as: Iterable<A>,
  f: (a: A) => Effect<S, R, E, B>
): Effect<unknown, R, E, readonly B[]>
export function foreachExec_<S, R, E, A, B>(
  es: ParallelN,
  as: Iterable<A>,
  f: (a: A) => Effect<S, R, E, B>
): Effect<unknown, R, E, readonly B[]>
export function foreachExec_<S, R, E, A, B>(
  es: ExecutionStrategy,
  as: Iterable<A>,
  f: (a: A) => Effect<S, R, E, B>
): Effect<unknown, R, E, readonly B[]>
export function foreachExec_<S, R, E, A, B>(
  es: ExecutionStrategy,
  as: Iterable<A>,
  f: (a: A) => Effect<S, R, E, B>
): Effect<unknown, R, E, readonly B[]> {
  switch (es._tag) {
    case "Sequential": {
      return foreach_(as, f) as any
    }
    case "Parallel": {
      return foreachPar_(as, f) as any
    }
    case "ParallelN": {
      return foreachParN_(es.n)(as, f) as any
    }
  }
}
