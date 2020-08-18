import * as E from "../../../_system/Either"
import { pipe, tuple } from "../../../_system/Function"
import { Erase } from "../../../_system/Utils"
import { Associative } from "../../Associative"
import { Auto, FixE, HKTURI, HKT2, URIS } from "../../HKT"
import { Applicative, Monad } from "../../Prelude"
import { Fail } from "../Fail"
import { Run } from "../Run"

export function getValidationF<F extends URIS, C = Auto>(
  F: Monad<F, C> & Run<F, C> & Fail<F, C> & Applicative<F, C>
): <Z>(A: Associative<Z>) => Applicative<F, Erase<C, Auto> & FixE<Z>>
export function getValidationF(
  F: Monad<HKTURI> & Run<HKTURI> & Fail<HKTURI> & Applicative<HKTURI>
): <Z>(A: Associative<Z>) => Applicative<HKTURI, FixE<Z>> {
  return <Z>(A: Associative<Z>): Applicative<HKTURI, FixE<Z>> => ({
    URI: F.URI,
    any: F.any,
    map: F.map,
    both: <B>(fb: HKT2<Z, B>) => <A>(fa: HKT2<Z, A>) =>
      pipe(
        F.run(fa),
        F.both(F.run(fb)),
        F.map(
          ([maybeA, maybeB]): HKT2<Z, readonly [A, B]> =>
            E.fold_(
              maybeA,
              (ea) =>
                E.fold_(
                  maybeB,
                  (eb) => F.fail(A.combine(eb)(ea)),
                  () => F.fail(ea)
                ),
              (a) =>
                E.fold_(
                  maybeB,
                  (e) => F.fail(e),
                  (b) =>
                    pipe(
                      F.any(),
                      F.map(() => tuple(a, b))
                    )
                )
            )
        ),
        F.flatten
      )
  })
}
