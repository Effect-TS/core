import Link from "next/link"
import React from "react"

import * as R from "../../src"
import { DT } from "../modules/date"
import { dateStateURI } from "../modules/date/state"
import { flashInitialState, flashStateURI } from "../modules/flash/state"
import { ORG } from "../modules/orgs"
import { orgsStateURI } from "../modules/orgs/state"
import { Home } from "../view/Home"

import * as T from "@matechs/core/Effect"
import { pipe } from "@matechs/core/Function"
import { combine } from "@matechs/core/Provider"

// alpha
/* istanbul ignore file */

const provider = combine().with(ORG.provide).with(DT.provide).done()

// tslint:disable-next-line: no-default-export
export default R.page(
  pipe(
    Home,
    T.map((C) => () => (
      <div>
        <C bar={"ok-bar"} />
        <br />
        <Link href={"/foo"}>
          <a>foo</a>
        </Link>
        <br />
        <Link href={"/ssg"}>
          <a>ssg</a>
        </Link>
        <br />
        <Link href={"/react"}>
          <a>react</a>
        </Link>
        <br />
        <Link href={"/react-async"}>
          <a>react-async</a>
        </Link>
      </div>
    )),
    provider
  )
)({
  [dateStateURI]: DT.initial,
  [orgsStateURI]: ORG.initial,
  [flashStateURI]: flashInitialState
})(
  // if static then initial props effect must be sync, page will be rendered
  // as static html, if ssr the props effect can be any async or sync
  // in case of ssr mode NextContext will be embedded (via getInitialProps)
  "static",
  T.pure({
    foo: "ok-foo"
  })
)
