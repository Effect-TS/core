import { reduce_ } from "../../Array"
import { UnionToIntersection } from "../../Base/Apply"
import { mergeEnvironments } from "../Has"

import * as T from "./deps"

export class Layer<S, R, E, A> {
  readonly _A!: A

  constructor(readonly build: T.Managed<S, R, E, A>) {}

  use<S1, R1, E1, A1>(
    effect: T.Effect<S1, R1 & A, E1, A1>
  ): T.Effect<S | S1, R & R1, E | E1, A1> {
    return T.managedUse_(this.build, (p) =>
      T.provideSome_(effect, (r: R1) => ({ ...p, ...r }))
    )
  }
}

export const pure = <T>(has: T.Has<T>) => (resource: T.Unbrand<T>) =>
  new Layer<never, unknown, never, T.Has<T>>(
    T.managedMap_(T.fromEffect(T.succeedNow(resource)), (a) =>
      mergeEnvironments(has, {}, a)
    )
  )

export const prepare = <T>(has: T.Has<T>) => <S, R, E, A extends T.Unbrand<T>>(
  acquire: T.Effect<S, R, E, A>
) => ({
  open: <S1, R1, E1>(open: (_: A) => T.Effect<S1, R1, E1, any>) => ({
    release: <S2, R2, E2>(release: (_: A) => T.Effect<S2, R2, E2, any>) =>
      fromManaged(has)(
        T.managedChain_(
          T.makeExit_(acquire, (a) => release(a)),
          (a) => T.fromEffect(T.map_(open(a), () => a))
        )
      )
  })
})

export const service = <T>(has: T.Has<T>) => ({
  fromEffect: fromEffect(has),
  fromManaged: fromManaged(has),
  pure: pure(has),
  prepare: prepare(has)
})

export const fromEffect = <T>(has: T.Has<T>) => <S, R, E>(
  resource: T.Effect<S, R, E, T.Unbrand<T>>
) =>
  new Layer<S, R, E, T.Has<T>>(
    T.managedChain_(T.fromEffect(resource), (a) =>
      T.fromEffect(T.access((r) => mergeEnvironments(has, r, a)))
    )
  )

export const fromManaged = <T>(has: T.Has<T>) => <S, R, E>(
  resource: T.Managed<S, R, E, T.Unbrand<T>>
) =>
  new Layer<S, R, E, T.Has<T>>(
    T.managedChain_(resource, (a) =>
      T.fromEffect(T.access((r) => mergeEnvironments(has, r, a)))
    )
  )

export const fromManagedEnv = <S, R, E, A>(
  resource: T.Managed<S, R, E, A>,
  overridable: "overridable" | "final" = "final"
) =>
  new Layer<S, R, E, A>(
    T.managedChain_(resource, (a) =>
      T.fromEffect(
        T.access((r: R) => (overridable === "final" ? { ...r, ...a } : { ...a, ...r }))
      )
    )
  )

export const fromEffectEnv = <S, R, E, A>(
  resource: T.Effect<S, R, E, A>,
  overridable: "overridable" | "final" = "final"
) =>
  new Layer<S, R, E, A>(
    T.managedChain_(T.fromEffect(resource), (a) =>
      T.fromEffect(
        T.access((r: R) => (overridable === "final" ? { ...r, ...a } : { ...a, ...r }))
      )
    )
  )

export const zip_ = <S, R, E, A, S2, R2, E2, A2>(
  left: Layer<S, R, E, A>,
  right: Layer<S2, R2, E2, A2>
) =>
  new Layer<S | S2, R & R2, E | E2, A & A2>(
    T.managedChain_(left.build, (l) =>
      T.managedChain_(right.build, (r) =>
        T.fromEffect(T.effectTotal(() => ({ ...l, ...r })))
      )
    )
  )

export const using = <S2, R2, E2, A2>(right: Layer<S2, R2, E2, A2>) => <S, R, E, A>(
  left: Layer<S, R & A2, E, A>
) => using_<S, R, E, A, S2, R2, E2, A2>(left, right)

export const using_ = <S, R, E, A, S2, R2, E2, A2>(
  left: Layer<S, R & A2, E, A>,
  right: Layer<S2, R2, E2, A2>
) =>
  new Layer<S | S2, R & R2, E | E2, A & A2>(
    T.managedChain_(right.build, (a2) =>
      T.managedMap_(
        T.managedProvideSome_(left.build, (r0: R & R2) => ({ ...a2, ...r0 })),
        (a) => ({ ...a2, ...a })
      )
    )
  )

export const zipPar = <S2, R2, E2, A2>(right: Layer<S2, R2, E2, A2>) => <S, R, E, A>(
  left: Layer<S, R, E, A>
) => zipPar_(left, right)

export const zipPar_ = <S, R, E, A, S2, R2, E2, A2>(
  left: Layer<S, R, E, A>,
  right: Layer<S2, R2, E2, A2>
) =>
  new Layer<unknown, R & R2, E | E2, A & A2>(
    T.managedChain_(
      T.managedZipWithPar_(left.build, right.build, (a, b) => [a, b] as const),
      ([l, r]) => T.fromEffect(T.effectTotal(() => ({ ...l, ...r })))
    )
  )

export type MergeS<Ls extends Layer<any, any, any, any>[]> = {
  [k in keyof Ls]: [Ls[k]] extends [Layer<infer X, any, any, any>] ? X : never
}[number]

export type MergeR<Ls extends Layer<any, any, any, any>[]> = UnionToIntersection<
  {
    [k in keyof Ls]: [Ls[k]] extends [Layer<any, infer X, any, any>]
      ? unknown extends X
        ? never
        : X
      : never
  }[number]
>

export type MergeE<Ls extends Layer<any, any, any, any>[]> = {
  [k in keyof Ls]: [Ls[k]] extends [Layer<any, any, infer X, any>] ? X : never
}[number]

export type MergeA<Ls extends Layer<any, any, any, any>[]> = UnionToIntersection<
  {
    [k in keyof Ls]: [Ls[k]] extends [Layer<any, any, any, infer X>]
      ? unknown extends X
        ? never
        : X
      : never
  }[number]
>

export const all = <Ls extends Layer<any, any, any, any>[]>(
  ...ls: Ls & { 0: Layer<any, any, any, any> }
): Layer<MergeS<Ls>, MergeR<Ls>, MergeE<Ls>, MergeA<Ls>> =>
  new Layer(
    T.managedMap_(
      T.foreach_(ls, (l) => l.build),
      (ps) => reduce_(ps, {} as any, (b, a) => ({ ...b, ...a }))
    )
  )

export const allPar = <Ls extends Layer<any, any, any, any>[]>(
  ...ls: Ls & { 0: Layer<any, any, any, any> }
): Layer<unknown, MergeR<Ls>, MergeE<Ls>, MergeA<Ls>> =>
  new Layer(
    T.managedMap_(
      T.foreachPar_(ls, (l) => l.build),
      (ps) => reduce_(ps, {} as any, (b, a) => ({ ...b, ...a }))
    )
  )

export const allParN = (n: number) => <Ls extends Layer<any, any, any, any>[]>(
  ...ls: Ls & { 0: Layer<any, any, any, any> }
): Layer<unknown, MergeR<Ls>, MergeE<Ls>, MergeA<Ls>> =>
  new Layer(
    T.managedMap_(
      T.foreachParN_(n)(ls, (l) => l.build),
      (ps) => reduce_(ps, {} as any, (b, a) => ({ ...b, ...a }))
    )
  )
