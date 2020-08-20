import { sequential } from "../Effect/ExecutionStrategy"
import * as T from "./deps"
import type { Managed } from "./managed"
import type { Finalizer, ReleaseMap } from "./releaseMap"

export function internalEffect<S, R, E, A>(
  self: Managed<S, R, E, A>
): T.Effect<S, readonly [R, ReleaseMap], E, readonly [Finalizer, A]> {
  return T.coerceSE<S, E>()(self.effect)
}

export function releaseAll<S, E>(
  rm: ReleaseMap,
  ex: T.Exit<any, any>
): T.Effect<S, unknown, E, any> {
  return T.coerceSE<S, E>()(rm.releaseAll(ex, sequential))
}
