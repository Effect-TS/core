import type * as A from "../../Array/core"
import type * as Q from "../../Queue"
import type { Stream } from "./definitions"
import { ensuringFirst_ } from "./ensuringFirst"
import { fromChunkQueue } from "./fromChunkQueue"

/**
 * Creates a stream from a {@link XQueue} of values. The queue will be shutdown once the stream is closed.
 */
export function fromChunkQueueWithShutdown<R, E, O>(
  queue: Q.XQueue<never, R, unknown, E, never, A.Array<O>>
): Stream<R, E, O> {
  return ensuringFirst_(fromChunkQueue(queue), queue.shutdown)
}
