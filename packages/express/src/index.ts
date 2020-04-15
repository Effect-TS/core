import { effect as T, managed as M } from "@matechs/effect";
import newExpress, * as EX from "express";
import { sequenceT } from "fp-ts/lib/Apply";
import { array } from "fp-ts/lib/Array";
import { left, right } from "fp-ts/lib/Either";
import { identity } from "fp-ts/lib/function";
import { Server } from "http";
import { NextHandleFunction } from "connect";
import { pipe } from "fp-ts/lib/pipeable";

export const expressAppEnv = "@matechs/express/expressAppURI";

export interface HasExpress {
  [expressAppEnv]: {
    app: EX.Express;
  };
}

export const serverEnv = "@matechs/express/serverURI";

export interface HasServer {
  [serverEnv]: {
    server: Server;
    onClose: Array<T.Task<void>>;
  };
}

export type Method = "post" | "get" | "put" | "patch" | "delete";

export const expressEnv = "@matechs/express/expressURI";

export interface ExpressOps {
  withApp<R, E, A>(op: T.Effect<R & HasExpress, E, A>): T.Effect<R, E, A>;
  route<R, E, A>(
    method: Method,
    path: string,
    f: (req: EX.Request) => T.Effect<R, RouteError<E>, RouteResponse<A>>,
    ...rest: NextHandleFunction[]
  ): T.Effect<R & HasExpress, T.NoErr, void>;
  bind(port: number, hostname?: string): T.TaskEnvErr<HasExpress, Error, Server>;
}

export interface Express {
  [expressEnv]: ExpressOps;
}

export interface RouteError<E> {
  status: number;
  body: E;
}

export function routeError<E>(status: number, body: E): RouteError<E> {
  return {
    status,
    body
  };
}

export interface RouteResponse<A> {
  status: number;
  body: A;
}

export function routeResponse<A>(status: number, body: A): RouteResponse<A> {
  return {
    status,
    body
  };
}

export const express: Express = {
  [expressEnv]: {
    route<R, E, A>(
      method: Method,
      path: string,
      f: (req: EX.Request) => T.Effect<R, RouteError<E>, RouteResponse<A>>,
      ...rest: NextHandleFunction[]
    ): T.Effect<R & HasExpress, T.NoErr, void> {
      return T.accessM((r: R & HasExpress) =>
        T.sync(() => {
          r[expressAppEnv].app[method](path, ...rest, (req, res) => {
            T.runToPromiseExit(T.provide(r)(f(req))).then((o) => {
              switch (o._tag) {
                case "Done":
                  res.status(o.value.status).send(o.value.body);
                  return;
                case "Raise":
                  res.status(o.error.status).send(o.error.body);
                  return;
                case "Interrupt":
                  res.status(500).send({
                    status: "interrupted"
                  });
                  return;
                case "Abort":
                  res.status(500).send({
                    status: "aborted",
                    with: o.abortedWith
                  });
                  return;
              }
            });
          });
        })
      );
    },
    withApp<R, E, A>(op: T.Effect<R & HasExpress, E, A>): T.Effect<R, E, A> {
      return T.accessM((r: R) =>
        pipe(
          op,
          T.provide<R & HasExpress>({
            ...r,
            [expressAppEnv]: { ...r[expressAppEnv], app: newExpress() }
          })
        )
      );
    },
    bind(port: number, hostname?: string): T.TaskEnvErr<HasExpress, Error, Server> {
      return T.accessM(({ [expressAppEnv]: { app } }: HasExpress) =>
        T.async<Error, Server>((res) => {
          const s = app.listen(port, hostname || "0.0.0.0", (err) => {
            if (err) {
              res(left(err));
            } else {
              res(right(s));
            }
          });

          return (cb) => {
            s.close((e) => {
              cb(e);
            });
          };
        })
      );
    }
  }
};

export function withApp<R, E, A>(op: T.Effect<R & HasExpress, E, A>): T.Effect<Express & R, E, A> {
  return T.accessM(({ [expressEnv]: express }: Express) => express.withApp(op));
}

export const requestContextEnv = "@matechs/express/requestContextURI";

export interface RequestContext {
  [requestContextEnv]: {
    request: EX.Request;
  };
}

export function route<R, E, A>(
  method: Method,
  path: string,
  handler: T.Effect<R, RouteError<E>, RouteResponse<A>>,
  middle: NextHandleFunction[] = [EX.json()]
): T.Effect<T.Erase<R, RequestContext> & HasExpress & Express, T.NoErr, void> {
  return T.accessM(({ [expressEnv]: express }: Express) =>
    express.route(
      method,
      path,
      (x) =>
        T.accessM((r: R & HasExpress & Express) =>
          T.provide({
            ...r,
            [requestContextEnv]: {
              request: x
            }
          })(handler)
        ),
      ...middle
    )
  );
}

export function bind(
  port: number,
  hostname?: string
): T.TaskEnvErr<HasExpress & Express, Error, Server> {
  return T.accessM(({ [expressEnv]: express }: Express) => express.bind(port, hostname));
}

export function accessAppM<R, E, A>(
  f: (app: EX.Express) => T.Effect<R, E, A>
): T.Effect<HasExpress & R, E, A> {
  return T.accessM(({ [expressAppEnv]: express }: HasExpress) => f(express.app));
}

export function accessReqM<R, E, A>(
  f: (req: EX.Request) => T.Effect<R, E, A>
): T.Effect<RequestContext & R, E, A> {
  return T.accessM(({ [requestContextEnv]: { request } }: RequestContext) => f(request));
}

export function accessReq<A>(f: (req: EX.Request) => A): T.Effect<RequestContext, never, A> {
  return T.access(({ [requestContextEnv]: { request } }: RequestContext) => f(request));
}

export function accessApp<A>(f: (app: EX.Express) => A): T.Effect<HasExpress, T.NoErr, A> {
  return T.access(({ [expressAppEnv]: express }: HasExpress) => f(express.app));
}

export type ExpressEnv = HasExpress & Express;

export type ChildEnv = ExpressEnv & RequestContext;

export const managedExpress = (port: number, hostname?: string) =>
  M.bracket(
    withApp(
      T.effect.map(
        sequenceT(T.effect)(bind(port, hostname), accessApp(identity)),
        ([server, app]): HasServer & HasExpress => ({
          [serverEnv]: {
            server,
            onClose: []
          },
          [expressAppEnv]: {
            app
          }
        })
      )
    ),
    (_) =>
      T.uninterruptible(
        T.effect.chain(T.result(array.sequence(T.effect)(_[serverEnv].onClose)), () =>
          T.async<Error, void>((res) => {
            _[serverEnv].server.close((err) => {
              if (err) {
                res(left(err));
              } else {
                res(right(undefined));
              }
            });
            return () => {
              //
            };
          })
        )
      )
  );
