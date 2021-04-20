import * as Tp from "../../../Structural"

export const TupleSym: unique symbol = Symbol.for(
  "@effect-ts/system/Collections/Immutable/Tuple"
)
export type TupleSym = typeof TupleSym

export function isTuple(self: unknown): self is Tuple<unknown[]> {
  return typeof self === "object" && self != null && TupleSym in self
}

export class Tuple<T extends readonly unknown[]> {
  [TupleSym](): TupleSym {
    return TupleSym
  }

  constructor(readonly tuple: T) {}

  [Tp.hashSym](): number {
    return Tp.hashArray(this.tuple)
  }

  [Tp.equalsSym](that: unknown): boolean {
    if (isTuple(that)) {
      return (
        this.tuple.length === that.tuple.length &&
        this.tuple.every((v, i) => Tp.equals(v, that.tuple[i]))
      )
    }
    return false
  }

  get<K extends keyof T>(i: K): T[K] {
    return this.tuple[i]
  }
}

export function tuple<Ks extends unknown[]>(...args: Ks): Tuple<Ks> {
  return new Tuple(args)
}
