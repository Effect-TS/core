import { identity } from "../Function"
import type { UnionToIntersection } from "../Utils"
import { foreach_, foreachPar_, foreachParN_ } from "./core"
import type { Managed } from "./managed"

export type SequenceR<T extends Array<Managed<any, any, any>>> = UnionToIntersection<
  {
    [K in keyof T]: [T[K]] extends [Managed<infer R, any, any>]
      ? unknown extends R
        ? never
        : R
      : never
  }[number]
>

export type SequenceE<T extends Array<Managed<any, any, any>>> = {
  [K in keyof T]: [T[K]] extends [Managed<any, infer E, any>] ? E : never
}[number]

export type SequenceA<T extends Array<Managed<any, any, any>>> = {
  [K in keyof T]: [T[K]] extends [Managed<any, any, infer A>] ? A : never
}

/**
 * Like `foreach` + `identity` with a tuple type
 */
export function sequenceT<T extends Array<Managed<any, any, any>>>(
  ...t: T & {
    0: Managed<any, any, any>
  }
): Managed<SequenceR<T>, SequenceE<T>, SequenceA<T>> {
  return foreach_(t, identity) as any
}

/**
 * Like sequenceT but parallel, same as `foreachPar` + `identity` with a tuple type
 */
export function sequenceTPar<T extends Array<Managed<any, any, any>>>(
  ...t: T & {
    0: Managed<any, any, any>
  }
): Managed<SequenceR<T>, SequenceE<T>, SequenceA<T>> {
  return foreachPar_(t, identity) as any
}

/**
 * Like sequenceTPar but uses at most n fibers concurrently,
 * same as `foreachParN` + `identity` with a tuple type
 */
export function sequenceTParN(
  n: number
): <T extends Array<Managed<any, any, any>>>(
  ...t: T & {
    0: Managed<any, any, any>
  }
) => Managed<SequenceR<T>, SequenceE<T>, SequenceA<T>> {
  return ((...t: Managed<any, any, any>[]) => foreachParN_(n)(t, identity)) as any
}
