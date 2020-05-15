import type { Option } from "fp-ts/lib/Option"

import { traverseWithIndex_ } from "../Record/traverseWithIndex_"

import { optionMonad } from "./monad"

export const traverseRecordWithIndex_ = traverseWithIndex_(optionMonad)

export const traverseRecordWithIndex: <A, B>(
  f: (k: string, a: A) => Option<B>
) => (ta: Record<string, A>) => Option<Record<string, B>> = (f) => (ta) =>
  traverseRecordWithIndex_(ta, f)
