import { combineProviders, T, pipe } from "@matechs/prelude"
import React from "react"

import * as R from "../../src"
import { DT } from "../modules/date"
import { dateStateURI } from "../modules/date/state"
import { flashInitialState, flashStateURI } from "../modules/flash/state"
import { ORG } from "../modules/orgs"
import { orgsStateURI } from "../modules/orgs/state"
import { Home } from "../view/Home"

// alpha
/* istanbul ignore file */

const provider = combineProviders().with(ORG.provide).with(DT.provide).done()

const PlainComponent = R.reactAsync(pipe(Home, provider))({
  [dateStateURI]: DT.initial,
  [orgsStateURI]: ORG.initial,
  [flashStateURI]: flashInitialState
})(
  // in react-async initial props can be generated via async
  T.delay(
    T.pure({
      foo: "ok"
    }),
    3000
  )
)

// tslint:disable-next-line: no-default-export
export default () => (
  <PlainComponent bar={"ok"}>
    <div>loading...</div>
  </PlainComponent>
)
