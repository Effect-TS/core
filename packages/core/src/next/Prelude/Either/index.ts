import * as E from "../../../Either"
import { pipe, tuple } from "../../../Function"
import { Failure } from "../Newtype"
import { intersect } from "../Utils"
import { makeAny } from "../abstract/Any"
import { makeApplicative, sequenceSF } from "../abstract/Applicative"
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
  interface URItoKind2<Err, Out> {
    [EitherURI]: E.Either<Err, Out>
    [FailureEitherURI]: FailureEither<Err, Out>
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

export const zip: <E, B>(
  fb: E.Either<E, B>
) => <E1, A>(fa: E.Either<E1, A>) => E.Either<E | E1, readonly [A, B]> = (fb) => (fa) =>
  E.chain_(fa, (a) => E.map_(fb, (b) => tuple(a, b)))

/**
 * The `AssociativeBoth` instance for `Either`.
 */
export const AssociativeBoth = makeAssociativeBoth(EitherURI)({
  both: zip
})

export const zipFailure = <E, B>(fb: FailureEither<E, B>) => <E1, A>(
  fa: FailureEither<E1, A>
): FailureEither<E | E1, [A, B]> =>
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
  both: zipFailure
})

export const either = <E, B>(fb: E.Either<E, B>) => <E1, A>(
  fa: E.Either<E1, A>
): E.Either<E | E1, E.Either<A, B>> =>
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
  either
})

export const eitherFailure = <E, B>(fb: FailureEither<E, B>) => <E1, A>(
  fa: FailureEither<E1, A>
): FailureEither<E | E1, E.Either<A, B>> =>
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
  either: eitherFailure
})

export const AssociativeFlatten = makeAssociativeFlatten(EitherURI)({
  flatten: E.flatten
})

/**
 * The `Applicative` instance for `Either`.
 */
export const Applicative = makeApplicative(EitherURI)(
  intersect(Any, AssociativeBoth, Covariant)
)

/**
 * The `Monad` instance for `Either`.
 */
export const Monad = makeMonad(EitherURI)(intersect(Covariant, Any, AssociativeFlatten))

/**
 * Struct based applicative
 */
export const sequenceS = sequenceSF(Applicative)

/**
 * API
 */
export {
  left,
  right,
  Either,
  Left,
  Right,
  alt,
  alt_,
  ap_,
  bimap,
  bimap_,
  chain,
  chainRec,
  chainTap as tap,
  chainTap_ as tap_,
  chain_,
  compact,
  duplicate,
  elem,
  elem_,
  exists,
  exists_,
  extend,
  extend_,
  filter,
  filterMap,
  filterMap_,
  filterOrElse,
  filterOrElse_,
  filter_,
  flatten,
  fold,
  foldMap,
  foldMap_,
  fold_,
  fromNullable,
  fromNullable_,
  fromOption,
  fromOption_,
  fromPredicate,
  fromPredicate_,
  getOrElse,
  isLeft,
  isRight,
  map,
  mapLeft,
  mapLeft_,
  map_,
  merge,
  orElse,
  orElse_,
  stringifyJSON,
  swap,
  toError,
  tryCatch,
  tryCatch_
} from "../../../Either"
