import * as E from "../Either"
import { pipe } from "../Function"
import type * as O from "../Option"
import { fromEither } from "./fromEither"

export function fromOptionWith_<A, E>(
  ma: O.Option<A>,
  onNone: () => E,
  __trace?: string
) {
  return pipe(E.fromOption_(ma, onNone), (x) => fromEither(() => x, __trace))
}

export function fromOptionWith<A, E>(onNone: () => E, __trace?: string) {
  return (ma: O.Option<A>) => fromOptionWith_(ma, onNone, __trace)
}
