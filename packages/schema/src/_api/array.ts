// tracing: off

import * as Chunk from "@effect-ts/core/Collections/Immutable/Chunk"
import { pipe } from "@effect-ts/core/Function"

import * as S from "../_schema"
import * as Arbitrary from "../Arbitrary"
import * as Guard from "../Guard"
import * as Th from "../These"
import { chunk } from "./chunk"

export function array<Self extends S.SchemaAny>(
  self: Self
): S.Schema<
  unknown,
  S.CompositionE<
    | S.PrevE<S.RefinementE<S.LeafE<S.UnknownArrayE>>>
    | S.NextE<S.ChunkE<S.OptionalIndexE<number, S.ParserErrorOf<Self>>>>
  >,
  readonly Self[],
  Iterable<S.ConstructorInputOf<Self>>,
  S.ChunkE<S.OptionalIndexE<number, S.ConstructorErrorOf<Self>>>,
  readonly Self[],
  readonly Self[],
  S.ApiOf<Self>
> {
  const guardSelf = Guard.for(self)
  const arbitrarySelf = Arbitrary.for(self)

  const fromChunk = pipe(
    S.identity((u): u is readonly Self[] => Array.isArray(u) && u.every(guardSelf)),
    S.parser((u: Chunk.Chunk<Self>) => Th.succeed(Chunk.toArray(u))),
    S.constructor((u: Chunk.Chunk<Self>) => Th.succeed(Chunk.toArray(u))),
    S.arbitrary((_) => _.array(arbitrarySelf(_)))
  )

  return pipe(
    chunk(self),
    S.compose(fromChunk),
    S.mapParserError((_) => Chunk.unsafeHead(_.errors).error),
    S.mapConstructorError((_) => Chunk.unsafeHead(_.errors).error),
    S.mapApi((_) => _.Self)
  )
}
