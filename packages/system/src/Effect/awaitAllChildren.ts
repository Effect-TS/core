// tracing: off

import { accessCallTrace } from "@effect-ts/tracing-utils"

import * as Fiber from "../Fiber"
import type { Effect } from "./effect"
import { ensuringChildren_ } from "./ensuringChildren"

/**
 * Returns a new effect that will not succeed with its value before first
 * waiting for the end of all child fibers forked by the effect.
 *
 * @trace call
 */
export function awaitAllChildren<R, E, A>(fa: Effect<R, E, A>): Effect<R, E, A> {
  return ensuringChildren_(fa, Fiber.waitAll, accessCallTrace())
}
