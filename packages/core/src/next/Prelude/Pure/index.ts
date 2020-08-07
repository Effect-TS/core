import { pipe, tuple } from "../../../Function"
import { makeAny } from "../abstract/Any"
import { makeApplicative } from "../abstract/Applicative"
import { makeAssociativeBoth } from "../abstract/AssociativeBoth"
import { makeAssociativeFlatten } from "../abstract/AssociativeFlatten"
import { makeCovariant } from "../abstract/Covariant"
import { makeMonad } from "../abstract/Monad"

import * as F from "./core"

export const XPureURI = "XPure"
export type XPureURI = typeof XPureURI

export const StateReaderErrorURI = "StateReaderError"
export type StateReaderErrorURI = typeof StateReaderErrorURI

declare module "../abstract/HKT" {
  interface URItoKind5<X, S, R, E, A> {
    [XPureURI]: F.XPure<X, S, R, E, A>
  }
  interface URItoKind4<S, R, E, A> {
    [StateReaderErrorURI]: F.XPure<S, S, R, E, A>
  }
}

/**
 * The `Any` instance for `XPure`.
 */
export const Any = makeAny(XPureURI)({
  any: () => F.succeed({})
})

/**
 * The `Covariant` instance for `XPure`.
 */
export const Covariant = makeCovariant(XPureURI)({
  map: F.map
})

/**
 * The `AssociativeBoth` instance for `StateReaderError`.
 */
export const AssociativeBoth = makeAssociativeBoth(StateReaderErrorURI)({
  both: (fb) => (fa) =>
    pipe(
      fa,
      F.chain((a) =>
        pipe(
          fb,
          F.map((b) => tuple(a, b))
        )
      )
    )
})

/**
 * The `AssociativeBoth` instance for `StateReaderError`.
 */
export const AssociativeFlatten = makeAssociativeFlatten(StateReaderErrorURI)({
  flatten: (ffa) => F.chain_(ffa, (x) => x)
})

/**
 * The `Monad` instance for `StateReaderError`.
 */
export const Monad = makeMonad(StateReaderErrorURI)({
  ...Any,
  ...AssociativeFlatten,
  ...Covariant
})

/**
 * The `Applicative` instance for `StateReaderError`.
 */
export const Applicative = makeApplicative(StateReaderErrorURI)({
  ...Any,
  ...AssociativeBoth,
  ...Covariant
})

/**
 * Core exports
 */
export {
  bimap,
  bimap_,
  catchAll,
  catchAll_,
  chain,
  chain_,
  fail,
  foldM,
  foldM_,
  map,
  mapError,
  mapError_,
  map_,
  run,
  runEither,
  runIO,
  runResult,
  runResult_,
  runState,
  runStateEither,
  runStateEither_,
  runState_,
  run_,
  succeed,
  XPure
} from "./core"
