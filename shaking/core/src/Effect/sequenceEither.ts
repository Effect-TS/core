import { sequence } from "../Either/either"

import { effect } from "./effect"

export const sequenceEither = sequence(effect)
