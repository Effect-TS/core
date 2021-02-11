import * as P from "../Prelude"
import * as It from "./operations"

export const IterableURI = "Iterable"
export type IterableURI = typeof IterableURI

declare module "@effect-ts/hkt" {
  interface URItoKind<FC, TC, N extends string, K, Q, W, X, I, S, R, E, A> {
    [IterableURI]: Iterable<A>
  }
}

export const Any = P.instance<P.Any<[IterableURI]>>({
  any: () => It.of(undefined)
})

export const None = P.instance<P.None<[IterableURI]>>({
  never: () => It.never
})

export const Covariant = P.instance<P.Covariant<[IterableURI]>>({
  map: It.map
})

export const AssociativeBoth = P.instance<P.AssociativeBoth<[IterableURI]>>({
  both: It.zip
})

export const AssociativeFlatten = P.instance<P.AssociativeFlatten<[IterableURI]>>({
  flatten: It.flatten
})

export const Applicative = P.instance<P.Applicative<[IterableURI]>>({
  ...Any,
  ...Covariant,
  ...AssociativeBoth
})

export const Monad = P.instance<P.Monad<[IterableURI]>>({
  ...Any,
  ...Covariant,
  ...AssociativeFlatten
})

export const ForEach = P.instance<P.ForEach<[IterableURI]>>({
  ...Covariant,
  forEachF: It.forEachF
})
