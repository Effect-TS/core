import { sequential } from "../Effect/ExecutionStrategy"
import type { Exit } from "../Exit"
import { pipe, tuple } from "../Function"
import type { HasTag } from "../Has"
import { has } from "../Has"
import { Managed } from "../Managed/managed"
import type { Finalizer, ReleaseMap } from "../Managed/releaseMap"
import * as RelMap from "../Managed/releaseMap"
import { insert } from "../Map"
import * as P from "../Promise"
import * as R from "../Ref"
import * as RM from "../RefM"
import * as T from "./deps"
import type { Layer } from "./Layer"

/**
 * A `MemoMap` memoizes dependencies.
 */

export class MemoMap {
  constructor(
    readonly ref: RM.RefM<
      ReadonlyMap<Layer<any, any, any>, readonly [T.IO<any, any>, Finalizer]>
    >
  ) {}

  /**
   * Checks the memo map to see if a dependency exists. If it is, immediately
   * returns it. Otherwise, obtains the dependency, stores it in the memo map,
   * and adds a finalizer to the outer `Managed`.
   */
  getOrElseMemoize = <R, E, A>(layer: Layer<R, E, A>) =>
    new Managed<R, E, A>(
      pipe(
        this.ref,
        RM.modify((m) => {
          const inMap = m.get(layer)

          if (inMap) {
            const [acquire, release] = inMap

            const cached = T.accessM(([_, rm]: readonly [R, ReleaseMap]) =>
              pipe(
                acquire as T.IO<E, A>,
                T.onExit((ex) => {
                  switch (ex._tag) {
                    case "Success": {
                      return RelMap.add(release)(rm)
                    }
                    case "Failure": {
                      return T.unit
                    }
                  }
                }),
                T.map((x) => [release, x] as readonly [Finalizer, A])
              )
            )

            return T.succeedNow(tuple(cached, m))
          } else {
            return pipe(
              T.do,
              T.bind("observers", () => R.makeRef(0)),
              T.bind("promise", () => P.make<E, A>()),
              T.bind("finalizerRef", () => R.makeRef<Finalizer>(RelMap.noopFinalizer)),
              T.let("resource", ({ finalizerRef, observers, promise }) =>
                T.uninterruptibleMask(({ restore }) =>
                  pipe(
                    T.do,
                    T.bind("env", () => T.environment<readonly [R, ReleaseMap]>()),
                    T.let("a", ({ env: [a] }) => a),
                    T.let(
                      "outerReleaseMap",
                      ({ env: [_, outerReleaseMap] }) => outerReleaseMap
                    ),
                    T.bind("innerReleaseMap", () => RelMap.makeReleaseMap),
                    T.bind("tp", ({ a, innerReleaseMap, outerReleaseMap }) =>
                      restore(
                        pipe(
                          T.provideAll_(layer.build.effect, [a, innerReleaseMap]),
                          T.result,
                          T.chain((e) => {
                            switch (e._tag) {
                              case "Failure": {
                                return pipe(
                                  promise,
                                  P.halt(e.cause),
                                  T.chain(
                                    () =>
                                      RelMap.releaseAll(
                                        e,
                                        sequential
                                      )(innerReleaseMap) as T.IO<E, any>
                                  ),
                                  T.chain(() => T.halt(e.cause))
                                )
                              }
                              case "Success": {
                                return pipe(
                                  T.do,
                                  T.tap(() =>
                                    finalizerRef.set((e) =>
                                      T.whenM(
                                        pipe(
                                          observers,
                                          R.modify((n) => [n === 1, n - 1])
                                        )
                                      )(
                                        RelMap.releaseAll(
                                          e,
                                          sequential
                                        )(innerReleaseMap) as T.UIO<any>
                                      )
                                    )
                                  ),
                                  T.tap(() =>
                                    pipe(
                                      observers,
                                      R.update((n) => n + 1)
                                    )
                                  ),
                                  T.bind("outerFinalizer", () =>
                                    RelMap.add((e) =>
                                      T.chain_(finalizerRef.get, (f) => f(e))
                                    )(outerReleaseMap)
                                  ),
                                  T.tap(() => pipe(promise, P.succeed(e.value[1]))),
                                  T.map(({ outerFinalizer }) =>
                                    tuple(outerFinalizer, e.value[1])
                                  )
                                )
                              }
                            }
                          })
                        )
                      )
                    ),
                    T.map(({ tp }) => tp)
                  )
                )
              ),
              T.let(
                "memoized",
                ({ finalizerRef, observers, promise }) =>
                  [
                    pipe(
                      promise,
                      P.await,
                      T.onExit((e) => {
                        switch (e._tag) {
                          case "Failure": {
                            return T.unit
                          }
                          case "Success": {
                            return pipe(
                              observers,
                              R.update((n) => n + 1)
                            )
                          }
                        }
                      })
                    ),
                    (e: Exit<any, any>) => T.chain_(finalizerRef.get, (f) => f(e))
                  ] as readonly [T.IO<any, any>, Finalizer]
              ),
              T.map(({ memoized, resource }) =>
                tuple(
                  resource as T.Effect<
                    readonly [R, ReleaseMap],
                    E,
                    readonly [Finalizer, A]
                  >,
                  insert(layer, memoized)(m) as ReadonlyMap<
                    Layer<any, any, any>,
                    readonly [T.IO<any, any>, Finalizer]
                  >
                )
              )
            )
          }
        }),
        T.flatten
      )
    )
}

export const HasMemoMap = has(MemoMap)
export type HasMemoMap = HasTag<typeof HasMemoMap>
