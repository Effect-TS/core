import { State } from "../../../src"
import { summon, AsOpaque } from "../../morphic"

import * as T from "@matechs/core/Effect"
import * as M from "@matechs/morphic"

const FlashState_ = summon((F) =>
  F.interface(
    {
      messages: F.array(F.string())
    },
    "FlashMessage"
  )
)

export interface FlashState extends M.AType<typeof FlashState_> {}
export interface FlashStateR extends M.EType<typeof FlashState_> {}
export const FlashState = AsOpaque<FlashStateR, FlashState>()(FlashState_)

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
