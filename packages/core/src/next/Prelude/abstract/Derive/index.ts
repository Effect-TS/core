import { HKT, Kind, URIS } from "../HKT"

export interface DeriveF<F, Typeclass> {
  readonly Derive: "Derive"
  readonly derive: <A>(fa: HKT<Typeclass, A>) => HKT<Typeclass, HKT<F, A>>
}

export interface Derive11<F extends URIS, Typeclass extends URIS> {
  readonly Derive: "Derive"
  readonly derive: <A>(fa: Kind<Typeclass, A>) => Kind<Typeclass, Kind<F, A>>
}

export function makeDerive<F extends URIS, Typeclass extends URIS>(
  _: F,
  __: Typeclass
): (_: Omit<Derive11<F, Typeclass>, "Derive">) => Derive11<F, Typeclass>
export function makeDerive<F, Typeclass>(
  _: F,
  __: Typeclass
): (_: Omit<DeriveF<F, Typeclass>, "Derive">) => DeriveF<F, Typeclass> {
  return (_) => ({
    Derive: "Derive",
    ..._
  })
}
