// tracing: off
import { traceAs } from "@effect-ts/tracing-utils"

import { then } from "../Cause/cause"
import { fold_ } from "../Exit/api"
import type { Exit } from "../Exit/exit"
import { chain_, foldCauseM_, halt, result } from "./core"
import { done } from "./done"
import type { Effect } from "./effect"
import { uninterruptibleMask } from "./interruption"

/**
 * Acquires a resource, uses the resource, and then releases the resource.
 * Neither the acquisition nor the release will be interrupted, and the
 * resource is guaranteed to be released, so long as the `acquire` effect
 * succeeds. If `use` fails, then after release, the returned effect will fail
 * with the same error.
 *
 * @trace 0
 * @trace 1
 */
export function bracketExit<A, E1, R1, A1, R2, E2, A2>(
  use: (a: A) => Effect<R1, E1, A1>,
  release: (a: A, e: Exit<E1, A1>) => Effect<R2, E2, A2>
) {
  return <R, E>(acquire: Effect<R, E, A>): Effect<R & R1 & R2, E | E1 | E2, A1> =>
    bracketExit_(acquire, use, release)
}

/**
 * Acquires a resource, uses the resource, and then releases the resource.
 * Neither the acquisition nor the release will be interrupted, and the
 * resource is guaranteed to be released, so long as the `acquire` effect
 * succeeds. If `use` fails, then after release, the returned effect will fail
 * with the same error.
 *
 * @trace 1
 * @trace 2
 */
export function bracketExit_<R, E, A, E1, R1, A1, R2, E2>(
  acquire: Effect<R, E, A>,
  use: (a: A) => Effect<R1, E1, A1>,
  release: (a: A, e: Exit<E1, A1>) => Effect<R2, E2, any>
): Effect<R & R1 & R2, E | E1 | E2, A1> {
  return uninterruptibleMask(({ restore }) =>
    chain_(
      acquire,
      traceAs(use, (a) =>
        chain_(
          result(restore(use(a))),
          traceAs(release, (e) =>
            foldCauseM_(
              release(a, e),
              (cause2) =>
                halt(
                  fold_(
                    e,
                    (_) => then(_, cause2),
                    (_) => cause2
                  )
                ),
              (_) => done(e)
            )
          )
        )
      )
    )
  )
}
