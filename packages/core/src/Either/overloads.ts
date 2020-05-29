/* adapted from https://github.com/rzeigler/waveguide */

import type { CFunctor2 } from "../Base"
import type { Kind2 } from "../Base/HKT"
import type { COf2 } from "../Base/Of"

import type { Either } from "."
import type { URI } from "./index"

export interface ChainRec2M<F extends URI> extends Chain2M<F> {
  readonly chainRec: <E, A, B>(
    a: A,
    f: (a: A) => Kind2<F, E, Either<A, B>>
  ) => Kind2<F, E, B>
}

export interface Chain2M<F extends URI> extends CFunctor2<F> {
  readonly chain: <A, B, E2>(
    f: (a: A) => Kind2<F, E2, B>
  ) => <E>(fa: Kind2<F, E, A>) => Kind2<F, E | E2, B>
}

export interface MonadThrow2M<M extends URI> extends Monad2M<M> {
  readonly throwError: <E, A>(e: E) => Kind2<M, E, A>
}

declare type EnforceNonEmptyRecord<R> = keyof R extends never ? never : R

export interface Apply2M<F extends URI> extends CFunctor2<F> {
  readonly ap: <A, B, E2>(
    fa: Kind2<F, E2, A>
  ) => <E>(fab: Kind2<F, E, (a: A) => B>) => Kind2<F, E | E2, B>
}

export interface Applicative2M<F extends URI> extends Apply2M<F>, COf2<F> {}
export interface Monad2M<M extends URI> extends Chain2M<M>, COf2<M> {}
export interface CAlt2M<F extends URI> extends CFunctor2<F> {
  readonly alt: <E, A>(
    fy: () => Kind2<F, E, A>
  ) => <E2, A2>(fx: Kind2<F, E2, A2>) => Kind2<F, E | E2, A | A2>
}
