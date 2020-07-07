import { Runtime } from "../Fiber/fiber"

import { bracket_ } from "./bracket_"
import { chain_ } from "./chain_"
import { Effect } from "./effect"
import { fiberId } from "./fiberId"
import { forkDaemon } from "./forkDaemon"

/**
 * Fork the effect into a separate fiber wrapping it in a bracket.
 * Acquisition will fork and release will interrupt the fiber.
 */
export const bracketFiber = <S2, R2, E2, A2, E, A>(
  use: (f: Runtime<E, A>) => Effect<S2, R2, E2, A2>
) => <S, R>(effect: Effect<S, R, E, A>) =>
  bracket_(forkDaemon(effect), (f) => chain_(fiberId(), (id) => f.interruptAs(id)), use)
