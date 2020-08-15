import { constant, flow, pipe, tuple } from "../../Function"
import { ApplicativeF, ApplicativeK } from "../Applicative"
import {
  AssociativeBothF,
  AssociativeBothK,
  makeAssociativeBoth
} from "../AssociativeBoth"
import { AssociativeFlattenF, AssociativeFlattenK } from "../AssociativeFlatten"
import { FailF, FailK } from "../FX/Fail"
import { IdentityErrF, IdentityErrK } from "../FX/IdentityErr"
import { RunF, RunK } from "../FX/Run"
import { castS, castSO, HKTTypeS, HKTTypeSO, URIS } from "../HKT"

import { succeedF } from "./core"

export function validationAssociativeBothF<
  F extends URIS,
  Fix0 = any,
  Fix1 = any,
  Fix2 = any,
  Fix3 = any
>(
  F: ApplicativeK<F, Fix0, Fix1, Fix2, Fix3> &
    RunK<F, Fix0, Fix1, Fix2, Fix3> &
    FailK<F, Fix0, Fix1, Fix2, Fix3> &
    IdentityErrK<F, Fix0, Fix1, Fix2, Fix3> &
    AssociativeFlattenK<F, Fix0, Fix1, Fix2, Fix3>
): AssociativeBothK<F, Fix0, Fix1, Fix2, Fix3>
export function validationAssociativeBothF<
  F,
  Fix0 = any,
  Fix1 = any,
  Fix2 = any,
  Fix3 = any
>(
  F: ApplicativeF<F, Fix0, Fix1, Fix2, Fix3> &
    RunF<F, Fix0, Fix1, Fix2, Fix3> &
    FailF<F, Fix0, Fix1, Fix2, Fix3> &
    IdentityErrF<F, Fix0, Fix1, Fix2, Fix3> &
    AssociativeFlattenF<F, Fix0, Fix1, Fix2, Fix3>
): AssociativeBothF<F, Fix0, Fix1, Fix2, Fix3>
export function validationAssociativeBothF<
  F,
  Fix0 = any,
  Fix1 = any,
  Fix2 = any,
  Fix3 = any
>(
  F: ApplicativeF<F, Fix0, Fix1, Fix2, Fix3> &
    RunF<F, Fix0, Fix1, Fix2, Fix3> &
    FailF<F, Fix0, Fix1, Fix2, Fix3> &
    IdentityErrF<F, Fix0, Fix1, Fix2, Fix3> &
    AssociativeFlattenF<F, Fix0, Fix1, Fix2, Fix3>
): AssociativeBothF<F, Fix0, Fix1, Fix2, Fix3> {
  return makeAssociativeBoth<F, Fix0, Fix1, Fix2, Fix3>(F.URI)({
    both: (fb) => (fa) => {
      const coerce = flow(
        castS<HKTTypeS<typeof fa>>()(F.URI),
        castSO<HKTTypeSO<typeof fb>>()(F.URI)
      )

      return pipe(
        F.run(fa),
        F.both(F.run(fb)),
        F.map(([l, r]) => {
          switch (l._tag) {
            case "Left": {
              switch (r._tag) {
                case "Right": {
                  return coerce(F.fail(l.left))
                }
                case "Left": {
                  return coerce(F.fail(F.combineErr(r.left)(l.left)))
                }
              }
            }
            case "Right": {
              switch (r._tag) {
                case "Right": {
                  return coerce(succeedF(F)(constant(tuple(l.right, r.right))))
                }
                case "Left": {
                  return coerce(F.fail(r.left))
                }
              }
            }
          }
        }),
        F.flatten
      )
    }
  })
}
