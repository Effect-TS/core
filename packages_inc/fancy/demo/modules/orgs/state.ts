import { T, O } from "@matechs/prelude"
import { AType, EType } from "@morphic-ts/batteries/lib/usage/utils"

import { State } from "../../../src"
import { summon, AsOpaque } from "../../morphic"

// alpha
/* istanbul ignore file */

export const OrgsState_ = summon((F) =>
  F.interface(
    {
      found: F.nullable(F.string()),
      error: F.nullable(F.string())
    },
    "OrgsState"
  )
)

export interface OrgsState extends AType<typeof OrgsState_> {}
export interface OrgsStateR extends EType<typeof OrgsState_> {}

export const OrgsState = AsOpaque<OrgsStateR, OrgsState>()(OrgsState_)

export const initialState = T.pure(OrgsState.build({ error: O.none, found: O.none }))

export const orgsStateURI = "@example/orgs"

export interface OrgsStateEnv
  extends State<{
    [orgsStateURI]: OrgsState
  }> {}
