import { makeDeferred } from "../Deferred"
import { applySecond, map_, Sync, unit } from "../Effect"
import { identity } from "../Function"
import { makeRef } from "../Ref"

import { ConcurrentQueue } from "./ConcurrentQueue"
import { droppingOffer } from "./droppingOffer"
import { initial } from "./initial"
import { makeConcurrentQueueImpl } from "./makeConcurrentQueueImpl"
import { natCapacity } from "./natCapacity"

/**
 * Create a dropping queue with the given capacity that drops offers on full
 * @param capacity
 */
export function droppingQueue<A>(capacity: number): Sync<ConcurrentQueue<A>> {
  return applySecond(
    natCapacity(capacity),
    map_(makeRef(initial<A>()), (ref) =>
      makeConcurrentQueueImpl(
        ref,
        makeDeferred<unknown, unknown, never, A>(),
        droppingOffer(capacity),
        unit,
        identity
      )
    )
  )
}
