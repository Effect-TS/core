import { makeServer, RequestError, Server, ServerConfig } from "./"

import * as T from "@matechs/core/Eff/Effect"
import * as L from "@matechs/core/Eff/Layer"
import { pipe } from "@matechs/core/Function"
import * as O from "@matechs/core/Option"
import * as MO from "@matechs/morphic"
import { HKT2 } from "@matechs/morphic-alg/utils/hkt"
import { AlgebraNoUnion } from "@matechs/morphic/batteries/program"
import { Codec, failure, success } from "@matechs/morphic/model"

export const S = makeServer(T.has<Server>()())

const serverConfig = L.service(S.config).pure(new ServerConfig(8080, "0.0.0.0"))

export const currentUser = S.makeState<O.Option<string>>(O.none)

//
// Person Post Endpoint
//

const personPostParams = MO.make((F) => F.interface({ id: F.string() }))

const personPostBody = MO.make((F) => F.interface({ name: F.string() }))

const personPostResponse = S.response(
  MO.make((F) => F.interface({ id: F.string(), name: F.string() }))
)

const customErrorResponse = S.response(
  MO.make((F) => F.interface({ error: F.string() }))
)

const customErrorHandler = T.catchAll((e: RequestError) => {
  switch (e._tag) {
    case "JsonDecoding": {
      return pipe(
        customErrorResponse({ error: "invalid json body" }),
        T.first(S.status(400))
      )
    }
    default: {
      return e.render()
    }
  }
})

export const personPost = S.route(
  "POST",
  "/person/:id",
  pipe(
    T.of,
    T.bind("params", () => S.params(personPostParams)),
    T.bind("body", () => S.body(personPostBody)),
    T.chain(({ body: { name }, params: { id } }) => personPostResponse({ id, name })),
    customErrorHandler
  )
)

export const auth = S.use(
  "(.*)",
  pipe(
    S.setState(currentUser)(O.some("test")),
    T.chain(() => S.next),
    T.timed,
    T.chain(([ms]) =>
      S.accessRouteInputM((i) =>
        T.effectTotal(() => {
          console.log(`request took: ${ms} ms (${i.query})`)
        })
      )
    )
  )
)

export const homeGet = S.route(
  "GET",
  "/home/a",
  S.accessConfigM((config) =>
    S.accessRouteInputM((input) =>
      T.effectTotal(() => {
        input.res.write(`good: ${config.host}:${config.port}`)
        input.res.end()
      })
    )
  )
)

export const homePostQueryParams = MO.make((F) =>
  F.partial({
    q: numberString(F)
  })
)

export const homePost = S.route(
  "POST",
  "/home/b",
  pipe(
    T.of,
    T.bind("body", () => S.bodyBuffer),
    T.bind("query", () => S.query(homePostQueryParams)),
    T.bind("user", () => S.getState(currentUser)),
    T.bind("res", () => S.accessRouteInputM((a) => T.succeedNow(a.res))),
    T.tap(({ body, query, res, user }) =>
      T.effectTotal(() => {
        res.write(body)
        res.write(JSON.stringify(query))
        res.write(JSON.stringify(user))
        res.end()
      })
    )
  )
)

//
// Custom morphic codec for numbers encoded as strings
//

function numberString<G, Env>(F: AlgebraNoUnion<G, Env>): HKT2<G, Env, string, number> {
  return F.unknownE(F.number(), {
    conf: {
      [MO.ModelURI]: () =>
        new Codec(
          "numberString",
          (i, c) => {
            if (typeof i === "string") {
              try {
                const n = parseFloat(i)

                if (isNaN(n)) {
                  return failure(i, c)
                }

                return success(n)
              } catch {
                return failure(i, c)
              }
            } else {
              return failure(i, c)
            }
          },
          (u) => (u as number).toString()
        )
    }
  }) as HKT2<G, Env, string, number>
}

//
// App Layer with all the routes & the server
//

const home = L.using(S.child("/home/(.*)"))(L.all(homeGet, homePost))

const appLayer = pipe(
  L.all(home, personPost),
  L.using(auth),
  L.using(S.server),
  L.using(serverConfig)
)

const cancel = pipe(T.never, T.provideSomeLayer(appLayer), T.runMain)

process.on("SIGINT", () => {
  cancel()
})
