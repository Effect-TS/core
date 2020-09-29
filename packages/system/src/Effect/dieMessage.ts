import { RuntimeError } from "../Cause"
import { die } from "./die"
import type { UIO } from "./effect"

/**
 * Returns an effect that dies with a {@link RuntimeError} having the
 * specified text message. This method can be used for terminating a fiber
 * because a defect has been detected in the code.
 */
export function dieMessage(message: string): UIO<never> {
  return die(new RuntimeError(message))
}
