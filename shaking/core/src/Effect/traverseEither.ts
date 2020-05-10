import { Either, either } from "../Either/either"
import type { Effect } from "../Support/Common/effect"

import { effect } from "./effect"

export const traverseEither: <A, S, R, FE, B>(
  f: (a: A) => Effect<S, R, FE, B>
) => <TE>(ta: Either<TE, A>) => Effect<S, R, FE, Either<TE, B>> = (f) => (ta) =>
  either.traverse(effect)(ta, f)
