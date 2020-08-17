import { AnyF, AnyK } from "../Any"
import { AssociativeBothF, AssociativeBothK } from "../AssociativeBoth"
import { URIS } from "../HKT"

/**
 * A binary operator that combines two values of types `F[A]` and `F[B]` to
 * produce an `F[(A, B)]` with an identity.
 */
export type IdentityBothF<
  F,
  TL0 = any,
  TL1 = any,
  TL2 = any,
  TL3 = any
> = AssociativeBothF<F, TL0, TL1, TL2, TL3> & AnyF<F, TL0, TL1, TL2, TL3>

export type IdentityBothK<
  F extends URIS,
  TL0 = any,
  TL1 = any,
  TL2 = any,
  TL3 = any
> = AssociativeBothK<F, TL0, TL1, TL2, TL3> & AnyK<F, TL0, TL1, TL2, TL3>
