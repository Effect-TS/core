import {
  AssociativeEither,
  AssociativeEither1,
  AssociativeEither2,
  AssociativeEither3,
  AssociativeEither4,
  AssociativeEither5,
  AssociativeEither6
} from "../AssociativeEither"
import { URIS, URIS2, URIS3, URIS4, URIS5, URIS6 } from "../HKT"
import { None, None1, None2, None3, None4, None5, None6 } from "../None"

/**
 * A binary operator that combines two values of types `F[A]` and `F[B]` to
 * produce an `F[Either[A, B]]` with an identity value.
 */
export type IdentityEither<F> = AssociativeEither<F> & None<F>

export type IdentityEither1<F extends URIS> = AssociativeEither1<F> & None1<F>

export type IdentityEither2<F extends URIS2> = AssociativeEither2<F> & None2<F>

export type IdentityEither3<F extends URIS3> = AssociativeEither3<F> & None3<F>

export type IdentityEither4<F extends URIS4> = AssociativeEither4<F> & None4<F>

export type IdentityEither5<F extends URIS5> = AssociativeEither5<F> & None5<F>

export type IdentityEither6<F extends URIS6> = AssociativeEither6<F> & None6<F>
