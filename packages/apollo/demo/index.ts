import { effect as T, managed as M } from "@matechs/effect";
import * as EX from "@matechs/express";
import { gql } from "apollo-server";
import { array as A } from "fp-ts";
import { pipe } from "fp-ts/lib/pipeable";
import { apollo } from "../src";
import * as O from "fp-ts/lib/Option";

// EXPERIMENTAL
/* istanbul ignore file */

const apolloURI = "myapp/unique-uri";
const Apollo = apollo(
  apolloURI,
  {
    subscriptions: {
      path: "/subscriptions",
      onConnect: (_, ws) =>
        T.access((_: { subOnConnect: string }) => ({
          ws,
          message: "ok"
        })),
      onDisconnect: () =>
        T.access((_: { subOnDisconnect: string }) => {
          //
        })
    }
  },
  ({ req, connection }) =>
    T.access((_: { contextFnEnv: string }) => ({
      req: connection ? O.none : O.some(req),
      sub: connection ? O.some(connection.context) : O.none
    }))
);

const typeDefs = gql`
  type Book {
    title: String
    author: String
  }
  type Query {
    books(n: Int!): [Book]
    hi: String
  }
  type DemoMessage {
    message: String
  }
  type Subscription {
    demo(n: Int!): DemoMessage
  }
  schema {
    query: Query
    subscription: Subscription
  }
`;

const books = Apollo.binder({
  ["Query/books"]: Apollo.resolver<{ n: number }>()(({ args }) =>
    pipe(
      T.access((_: { foo: string }) => _.foo),
      T.map((foo) =>
        pipe(
          A.range(0, args.n),
          A.map((i) => ({ title: `book: ${i}`, author: foo }))
        )
      )
    )
  )
});

const hi = Apollo.binder({
  ["Query/hi"]: () =>
    T.accessM((_: { bar: string }) =>
      pipe(
        Apollo.accessContext,
        T.chain(({ req }) => (O.isSome(req) ? T.pure(`${_.bar} - with req`) : T.pure(_.bar)))
      )
    )
});

async function* gen(n: number, message: O.Option<string>) {
  let i = 0;
  while (i < n) {
    yield {
      demo: { message: `${i++} - ${O.isSome(message) ? message.value : "no-sub"}` }
    };
  }
}

export const demo = Apollo.binder({
  ["Subscription/demo"]: Apollo.subscription<{ n: number }>()(
    (_) =>
      T.accessM(({ subN }: { subN: number }) =>
        pipe(
          Apollo.accessContext,
          T.chain(({ sub }) =>
            T.pure(
              gen(
                subN + _.args.n,
                pipe(
                  sub,
                  O.map(({ message }) => message)
                )
              )
            )
          )
        )
      ),
    (x) =>
      T.accessM(({ prefix }: { prefix: string }) =>
        pipe(
          Apollo.accessContext,
          T.chain(({ sub }) =>
            O.isSome(sub)
              ? T.pure({ message: `${prefix}: ${x.demo.message} (resolve: ${sub.value.message})` })
              : T.pure({ message: `${prefix}: ${x.demo.message}` })
          )
        )
      )
  )
});

const resolvers = Apollo.binder({
  ...hi,
  ...books,
  ...demo
});

const main = pipe(Apollo.bindToSchema(resolvers, typeDefs), M.provide(EX.managedExpress(8080)));

const cancel = pipe(
  main,
  T.provide({
    foo: "foo"
  }),
  T.provide({
    bar: "bar"
  }),
  T.provide({
    subN: 10
  }),
  T.provide({
    prefix: "ok"
  }),
  T.provide({
    subOnDisconnect: "ok"
  }),
  T.provide({
    subOnConnect: "ok"
  }),
  T.provide({
    contextFnEnv: "ok"
  }),
  T.provide(EX.express),
  (x) =>
    T.run(x, (ex) => {
      console.log(ex);
    })
);

process.on("SIGINT", () => {
  cancel();
});
