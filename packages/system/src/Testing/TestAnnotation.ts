import * as Chunk from "../Collections/Immutable/Chunk"
import * as List from "../Collections/Immutable/List"
import * as SS from "../Collections/Immutable/SortedSet"
import * as T from "../Effect"
import * as E from "../Either"
import type * as Fiber from "../Fiber"
import { runtimeOrd } from "../Fiber"
import { pipe } from "../Function"
import type { Tag } from "../Has"
import { tag } from "../Has"
import * as St from "../Structural"
import * as Supervisor from "../Supervisor"
import { AtomicReference } from "../Support/AtomicReference"
import * as Annotations from "./Annotations"
import { Int } from "./Int"

/**
 * A type of annotation.
 */
export class TestAnnotation<V> implements St.HasHash, St.HasEquals {
  constructor(
    readonly identifier: string,
    readonly initial: V,
    readonly combine: (x: V, y: V) => V,
    readonly tag: Tag<V>
  ) {}

  get [St.hashSym](): number {
    return St.combineHash(St.hash(this.identifier), St.hash(this.tag))
  }

  [St.equalsSym](that: unknown): boolean {
    return (
      that instanceof TestAnnotation &&
      St.equals(this.identifier, that.identifier) &&
      St.equals(this.tag, that.tag)
    )
  }
}

export type FibersAnnotation = E.Either<
  Int,
  Chunk.Chunk<AtomicReference<SS.SortedSet<Fiber.Runtime<unknown, unknown>>>>
>

export const FibersAnnotation = tag<FibersAnnotation>()

export const fibers: TestAnnotation<FibersAnnotation> = new TestAnnotation(
  "fibers",
  E.left(0 as Int),
  compose,
  FibersAnnotation
)

export function fibersPerTest<R, E, A>(self: T.Effect<R, E, A>) {
  const acquire = pipe(
    T.succeedWith(() => new AtomicReference(SS.make(runtimeOrd()))),
    T.tap((ref) => Annotations.annotate(fibers, E.right(Chunk.single(ref))))
  )

  const release = pipe(
    Annotations.get(fibers),
    T.chain((f) => {
      switch (f._tag) {
        case "Left":
          return T.unit
        case "Right":
          return pipe(
            f.right,
            T.forEach((_) => T.succeedWith(() => _.get)),
            T.map(Chunk.reduce(SS.make(runtimeOrd()), SS.union_)),
            T.map(SS.size),
            T.tap((n) => Annotations.annotate(fibers, E.left(Int(n))))
          )
      }
    })
  )

  return T.bracket_(
    acquire,
    (ref) =>
      pipe(
        Supervisor.fibersIn(ref),
        T.chain((supervisor) => T.supervised_(self, supervisor))
      ),
    () => release
  )
}

function compose<A>(
  left: E.Either<Int, Chunk.Chunk<A>>,
  right: E.Either<Int, Chunk.Chunk<A>>
): E.Either<Int, Chunk.Chunk<A>> {
  if (left._tag === "Left" && right._tag === "Left") {
    return E.left(Int(left.left + right.left))
  } else if (left._tag === "Right" && right._tag === "Right") {
    return E.right(Chunk.concat_(left.right, right.right))
  } else if (left._tag === "Right" && right._tag === "Left") {
    return E.left(right.left)
  } else {
    return E.right((right as E.Right<Chunk.Chunk<A>>).right)
  }
}

export type LocationAnnotation = List.List<Fiber.SourceLocation>

export const LocationAnnotation = tag<LocationAnnotation>()

export const location: TestAnnotation<LocationAnnotation> = new TestAnnotation(
  "location",
  List.empty(),
  List.concat_,
  LocationAnnotation
)
