import { Sequence1 } from "fp-ts/lib/Traversable"

import { sequence as sequence_1 } from "../Readonly/Array/sequence"

import { URI } from "./URI"

export const sequence: Sequence1<URI> = sequence_1 as any
