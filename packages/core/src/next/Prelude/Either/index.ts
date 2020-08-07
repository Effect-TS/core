import * as E from "../../../Either"
import { pipe, tuple } from "../../../Function"
import { Failure } from "../Newtype"
import { makeAny } from "../abstract/Any"
import { makeApplicative } from "../abstract/Applicative"
import { makeAssociativeBoth } from "../abstract/AssociativeBoth"
import { makeAssociativeEither } from "../abstract/AssociativeEither"
import { makeAssociativeFlatten } from "../abstract/AssociativeFlatten"
import { makeCovariant } from "../abstract/Covariant"
import { makeMonad } from "../abstract/Monad"

export const EitherURI = "Either"
export type EitherURI = typeof EitherURI

export const FailureEitherURI = "FailureEither"
export type FailureEitherURI = typeof FailureEitherURI

export type FailureEither<E, A> = Failure<E.Either<A, E>>

declare module "../abstract/HKT" {
  interface URItoKind2<E, A> {
    [EitherURI]: E.Either<E, A>
    [FailureEitherURI]: FailureEither<E, A>
  }
}

/**
 * The `Covariant` instance for `Either`.
 */
export const Covariant = makeCovariant(EitherURI)({
  map: E.map
})

/**
 * The `Any` instance for `Either`.
 */
export const Any = makeAny(EitherURI)({
  any: () => E.right({})
})

export const associativeBoth: <E, B>(
  fb: E.Either<E, B>
) => <A>(fa: E.Either<E, A>) => E.Either<E, readonly [A, B]> = (fb) => (fa) =>
  E.chain_(fa, (a) => E.map_(fb, (b) => tuple(a, b)))

/**
 * The `AssociativeBoth` instance for `Either`.
 */
export const AssociativeBoth = makeAssociativeBoth(EitherURI)({
  both: associativeBoth
})

export const associativeFailureBoth = <E, B>(fb: FailureEither<E, B>) => <A>(
  fa: FailureEither<E, A>
): FailureEither<E, [A, B]> =>
  pipe(
    fa,
    Failure.unwrap,
    E.swap,
    E.chain((a) =>
      pipe(
        fb,
        Failure.unwrap,
        E.swap,
        E.map((b) => tuple(a, b))
      )
    ),
    E.swap,
    Failure.wrap
  )

/**
 * The `AssociativeBoth` instance for a failed `Either`
 */
export const AssociativeFailureBoth = makeAssociativeBoth(FailureEitherURI)({
  both: associativeFailureBoth
})

export const associativeEither = <E, B>(fb: E.Either<E, B>) => <A>(
  fa: E.Either<E, A>
): E.Either<E, E.Either<A, B>> =>
  pipe(
    fa,
    E.map((a) => E.left(a)),
    E.swap,
    E.chain(() =>
      pipe(
        fb,
        E.map((a) => E.right(a)),
        E.swap
      )
    ),
    E.swap
  )
/**
 * The `AssociativeEither` instance for `Either`.
 */
export const AssociativeEither = makeAssociativeEither(EitherURI)({
  either: associativeEither
})

export const associativeFailureEither = <E, B>(fb: FailureEither<E, B>) => <A>(
  fa: FailureEither<E, A>
): FailureEither<E, E.Either<A, B>> =>
  pipe(
    fa,
    Failure.unwrap,
    E.swap,
    E.map(E.left),
    E.chain(() => pipe(fb, Failure.unwrap, E.swap, E.map(E.right))),
    E.swap,
    Failure.wrap
  )

/**
 * The `AssociativeEither` instance for a failed `Either`
 */
export const AssociativeFailureEither = makeAssociativeEither(FailureEitherURI)({
  either: associativeFailureEither
})

export const AssociativeFlatten = makeAssociativeFlatten(EitherURI)({
  flatten: E.flatten
})

/**
 * The `Applicative` instance for `Either`.
 */
export const Applicative = makeApplicative(EitherURI)({
  ...Any,
  ...Covariant,
  ...AssociativeBoth
})

/**
 * The `Monad` instance for `Either`.
 */
export const Monad = makeMonad(EitherURI)({
  ...Any,
  ...Covariant,
  ...AssociativeFlatten
})
