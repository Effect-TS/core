import * as Tp from "../../Tuple"
import type { Chunk } from "../definition"
import { zipWith_ } from "./zipWith"

/**
 * Zips this chunk with the specified chunk using the specified combiner.
 */
export function zip_<A, B>(self: Chunk<A>, that: Chunk<B>): Chunk<Tp.Tuple<[A, B]>> {
  return zipWith_(self, that, Tp.tuple)
}

/**
 * Zips this chunk with the specified chunk using the specified combiner.
 *
 * @dataFirst zip_
 */
export function zip<A, B>(that: Chunk<B>): (self: Chunk<A>) => Chunk<Tp.Tuple<[A, B]>> {
  return (self) => zip_(self, that)
}
