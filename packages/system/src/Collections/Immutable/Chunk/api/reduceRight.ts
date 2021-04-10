import type * as Chunk from "../core"
import { concreteId } from "../definition"

/**
 * Folds over the elements in this chunk from the right.
 */
export function reduceRight_<A, S>(
  self: Chunk.Chunk<A>,
  s: S,
  f: (a: A, s: S) => S
): S {
  const iterator = concreteId(self).reverseArrayLikeIterator()
  let next
  let s1 = s

  while ((next = iterator.next()) && !next.done) {
    const array = next.value
    const len = array.length
    let i = len - 1
    while (i >= 0) {
      const a = array[i]!
      s1 = f(a, s1)
      i--
    }
  }

  return s1
}

/**
 * Folds over the elements in this chunk from the right.
 *
 * @dataFirst reduceRight_
 */
export function reduceRight<A, S>(
  s: S,
  f: (a: A, s: S) => S
): (self: Chunk.Chunk<A>) => S {
  return (self) => reduceRight_(self, s, f)
}
