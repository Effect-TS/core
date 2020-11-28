import type * as A from "../../Array"
import type * as T from "../_internal/effect"
import type * as M from "../_internal/managed"
import * as SK from "../Sink"
import type { Stream } from "./definitions"
import { runManaged_ } from "./runManaged"

/**
 * Like `Stream#foreachChunk`, but returns a `Managed` so the finalization order
 * can be controlled.
 */
export function foreachChunkManaged<R, R1, E, E1, O>(
  self: Stream<R, E, O>,
  f: (f: A.Array<O>) => T.Effect<R1, E1, any>
): M.Managed<R & R1, E | E1, void> {
  return runManaged_(self, SK.foreachChunk(f))
}
