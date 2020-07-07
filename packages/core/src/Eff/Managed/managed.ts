import * as T from "./deps"
import { ReleaseMap, Finalizer, FinalizerT } from "./releaseMap"

export const noop: Finalizer = () => T.unit

export const ManagedURI = "@matechs/core/Eff/ManagedURI"
export type ManagedURI = typeof ManagedURI

export class Managed<S, R, E, A> {
  readonly [T._U]: ManagedURI;
  readonly [T._S]: () => S;
  readonly [T._E]: () => E;
  readonly [T._A]: () => A;
  readonly [T._R]: (_: R) => void

  constructor(readonly effect: T.AsyncRE<[R, ReleaseMap], E, [FinalizerT<E>, A]>) {}
}

declare module "../../Base/HKT" {
  interface MaToKind<S, R, E, A> {
    [ManagedURI]: Managed<S, R, E, A>
  }
}

export type Sync<A> = Managed<never, unknown, never, A>
export type SyncE<E, A> = Managed<never, unknown, E, A>
export type SyncR<R, A> = Managed<never, R, never, A>
export type SyncRE<R, E, A> = Managed<never, R, E, A>
export type Async<A> = Managed<unknown, unknown, never, A>
export type AsyncR<R, A> = Managed<unknown, R, never, A>
export type AsyncE<E, A> = Managed<unknown, unknown, E, A>
export type AsyncRE<R, E, A> = Managed<unknown, R, E, A>
