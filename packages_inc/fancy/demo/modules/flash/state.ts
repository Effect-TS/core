import { State } from "../../../src"

import * as T from "@matechs/core/Effect"
import * as M from "@matechs/morphic"

const FlashState_ = M.make((F) =>
  F.interface({
    messages: F.mutable(F.array(F.string()))
  })
)

export interface FlashState extends M.AType<typeof FlashState_> {}
export interface FlashStateR extends M.EType<typeof FlashState_> {}
export const FlashState = M.opaque<FlashStateR, FlashState>()(FlashState_)

export const flashInitialState = T.pure(
  FlashState.build({
    messages: []
  })
)

export const flashStateURI = "@example/flash"

export interface FlashStateEnv
  extends State<{
    [flashStateURI]: FlashState
  }> {}
