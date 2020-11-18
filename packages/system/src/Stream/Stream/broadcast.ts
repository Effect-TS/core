import * as A from "../../Array"
import { pipe } from "../../Function"
import * as M from "../../Managed"
import { broadcastedQueues_ } from "./broadcastQueues"
import type { Stream } from "./definitions"
import { flattenExitOption } from "./flattenExitOption"
import { fromQueueWithShutdown } from "./fromQueueWithShutdown"

/**
 * Fan out the stream, producing a list of streams that have the same elements as this stream.
 * The driver stream will only ever advance of the `maximumLag` chunks before the
 * slowest downstream stream.
 */
export function broadcast(n: number, maximumLag: number) {
  return <R, E, O>(self: Stream<R, E, O>) => broadcast_(self, n, maximumLag)
}

/**
 * Fan out the stream, producing a list of streams that have the same elements as this stream.
 * The driver stream will only ever advance of the `maximumLag` chunks before the
 * slowest downstream stream.
 */
export function broadcast_<R, E, O>(
  self: Stream<R, E, O>,
  n: number,
  maximumLag: number
): M.Managed<R, never, A.Array<Stream<unknown, E, O>>> {
  return pipe(
    broadcastedQueues_(self, n, maximumLag),
    M.map(A.map((q) => flattenExitOption(fromQueueWithShutdown(q))))
  )
}
