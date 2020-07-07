import * as O from "../../Option"
import { FiberContext } from "../Fiber/context"

import { Effect, AsyncR } from "./effect"
import { IFork } from "./primitives"

/**
 * Returns an effect that forks this effect into its own separate fiber,
 * returning the fiber immediately, without waiting for it to begin
 * executing the effect.
 *
 * The returned fiber can be used to interrupt the forked fiber, await its
 * result, or join the fiber. See `Fiber` for more information.
 *
 * The fiber is forked with interrupt supervision mode, meaning that when the
 * fiber that forks the child exits, the child will be interrupted.
 */
export const fork = <S, R, E, A>(
  value: Effect<S, R, E, A>
): AsyncR<R, FiberContext<E, A>> => new IFork(value, O.none)
