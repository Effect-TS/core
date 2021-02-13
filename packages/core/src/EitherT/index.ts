import * as E from "../Either"
import { pipe } from "../Function"
import type { Any, Applicative, Covariant, Monad, URI } from "../Prelude"
import { succeedF } from "../Prelude/DSL"
import type { Fail, Run } from "../Prelude/FX"
import * as HKT from "../Prelude/HKT"

export type V<C> = HKT.CleanParam<C, "E"> & HKT.V<"E", "+">

export function monad<F extends HKT.URIS, C>(
  M: Monad<F, C>
): Monad<[F[0], ...HKT.Rest<F>, URI<E.EitherURI>], V<C>>
export function monad<F>(M: Monad<HKT.UHKT<F>>) {
  const succeed = succeedF(M)
  return HKT.instance<Monad<[HKT.UHKT<F>[0], URI<E.EitherURI>], HKT.V<"E", "+">>>({
    any: () => succeedF(M)(E.right({})),
    flatten: <E, A, E2>(
      ffa: HKT.HKT<F, E.Either<E2, HKT.HKT<F, E.Either<E, A>>>>
    ): HKT.HKT<F, E.Either<E | E2, A>> =>
      pipe(
        ffa,
        M.map((e) => (e._tag === "Left" ? succeed<E.Either<E | E2, A>>(e) : e.right)),
        M.flatten
      ),
    map: (f) => M.map(E.map(f))
  })
}

export function applicative<F extends HKT.URIS, C>(
  M: Applicative<F, C>
): Applicative<[F[0], ...HKT.Rest<F>, URI<E.EitherURI>], V<C>>
export function applicative<F>(M: Applicative<HKT.UHKT<F>>) {
  return HKT.instance<Applicative<[HKT.UHKT<F>[0], URI<E.EitherURI>], HKT.V<"E", "+">>>(
    {
      any: () => succeedF(M)(E.right({})),
      map: (f) => M.map(E.map(f)),
      both: (fb) => (x) =>
        pipe(
          x,
          M.both(fb),
          M.map(([ea, eb]) => E.AssociativeBoth.both(eb)(ea))
        )
    }
  )
}

export function run<F extends HKT.URIS, C>(
  M: Covariant<F, C>
): Run<[F[0], ...HKT.Rest<F>, URI<E.EitherURI>], V<C>>
export function run<F>(M: Covariant<HKT.UHKT<F>>) {
  return HKT.instance<Run<[HKT.UHKT<F>[0], URI<E.EitherURI>], HKT.V<"E", "+">>>({
    either: <
      <E, A>(
        fa: HKT.HKT<F, E.Either<E, A>>
      ) => HKT.HKT<F, E.Either<never, E.Either<E, A>>>
    >M.map(E.Run.either)
  })
}

export function fail<F extends HKT.URIS, C>(
  M: Any<F, C> & Covariant<F, C>
): Fail<[F[0], ...HKT.Rest<F>, URI<E.EitherURI>], V<C>>
export function fail<F>(M: Any<HKT.UHKT<F>> & Covariant<HKT.UHKT<F>>) {
  const succeed = succeedF(M)
  return HKT.instance<Fail<[HKT.UHKT<F>[0], URI<E.EitherURI>], HKT.V<"E", "+">>>({
    fail: (x) => pipe(x, E.left, succeed)
  })
}
