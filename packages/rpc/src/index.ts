import { effect as T } from "@matechs/effect";
import * as H from "@matechs/http";
import * as A from "fp-ts/lib/Array";
import * as EX from "@matechs/express/lib";
import {
  Tracer,
  ChildContext,
  HasTracerContext,
  withTracer
} from "@matechs/tracing";
import { pipe } from "fp-ts/lib/pipeable";

export type CanRemote = {
  [k: string]: { [h: string]: (...args: any[]) => T.Effect<any, Error, any> };
};

export type PatchedF<M> = M extends (
  ...args: infer A
) => T.Effect<any, Error, infer D>
  ? (...args: A) => T.Effect<H.HttpClient, Error, D>
  : never;

export type Remote<M> = M extends {
  [k: string]: { [h: string]: (...args: any[]) => T.Effect<any, any, any> };
}
  ? { [k in keyof M]: { [h in keyof M[k]]: PatchedF<M[k][h]> } }
  : never;

export function calculatePath(url: string, entry: string, k: string) {
  return `${url}/${entry}/${k}`;
}

export type Payload = { data: any[] };

export function remotely<A extends any[], R, E, B>(
  _: (...args: A) => T.Effect<R, E, B>,
  url: string,
  entry: string,
  k: string
): (...args: A) => T.Effect<H.HttpClient & R, Error | E, B> {
  return (...args: A) =>
    pipe(
      H.post<{ message: string }, { result: B }>(calculatePath(url, entry, k), {
        data: args
      } as Payload),
      T.map(r => r.data.result),
      T.mapError(e => {
        if (e.response && e.response.data && e.response.data.message) {
          return new Error(e.response.data.message);
        } else {
          return e as Error;
        }
      })
    );
}

export function reinterpretRemotely<M extends CanRemote>(
  module: M,
  url: string
): Remote<M> {
  const patched = {};

  Object.keys(module).forEach(entry => {
    patched[entry] = {};

    Object.keys(module[entry]).forEach(k => {
      const fn = module[entry][k];

      patched[entry][k] = remotely(fn, url, entry, k);
    });
  });

  return patched as any;
}

export type PatchedClientF<M, Z extends CanRemote> = M extends (
  ...args: infer A
) => T.Effect<any, Error, infer D>
  ? (...args: A) => T.Effect<H.HttpClient & Remote<Z>, Error, D>
  : never;

export type ClientHelpers<M> = M extends {
  [k: string]: { [h: string]: (...args: any[]) => T.Effect<any, any, any> };
}
  ? { [k in keyof M]: { [h in keyof M[k]]: PatchedClientF<M[k][h], M> } }
  : never;

export function clientHelpers<M extends CanRemote>(
  module: M
): ClientHelpers<M> {
  const patched = {};

  Object.keys(module).forEach(entry => {
    patched[entry] = {};

    Object.keys(module[entry]).forEach(k => {
      patched[entry][k] = (...args: any[]) =>
        T.accessM((r: Remote<M>) => r[entry][k](...args));
    });
  });

  return patched as any;
}

export type PatchedServerF<M, Z extends CanRemote> = M extends (
  ...args: infer A
) => T.Effect<infer R, Error, infer D>
  ? (...args: A) => T.Effect<Z & R, Error, D>
  : never;

export type ServerHelpers<M> = M extends {
  [k: string]: { [h: string]: (...args: any[]) => T.Effect<any, any, any> };
}
  ? { [k in keyof M]: { [h in keyof M[k]]: PatchedServerF<M[k][h], M> } }
  : never;

export function serverHelpers<M extends CanRemote>(
  module: M
): ServerHelpers<M> {
  const patched = {};

  Object.keys(module).forEach(entry => {
    patched[entry] = {};

    Object.keys(module[entry]).forEach(k => {
      patched[entry][k] = (...args: any[]) =>
        T.accessM((r: M) => r[entry][k](...args));
    });
  });

  return patched as any;
}

export type Runtime<M> = M extends {
  [h: string]: (...args: any[]) => T.Effect<infer Q & ChildContext, any, any>;
}
  ? Q
  : never;

export function bindToApp<M extends CanRemote, K extends keyof M>(
  module: M,
  entry: K,
  runtime: Runtime<M[K]>,
  controller: string = `RPC Server - ${entry}`
): T.Effect<Tracer & EX.HasExpress & EX.Express, never, void> {
  return withTracer(
    T.accessM(({ tracer: { withControllerSpan } }: Tracer & HasTracerContext) =>
      pipe(
        A.array.traverse(T.effect)(Object.keys(module[entry]), k =>
          EX.route("post", `/${entry}/${k}`, req =>
            pipe(
              // TODO: find better solution to avoid deepmerge
              T.provide(runtime)(
                withControllerSpan(
                  controller,
                  `${entry}/${k}`,
                  req.headers as any
                )(module[entry][k](...req.body["data"]))
              ),
              T.map(x => ({ result: x })),
              T.mapError(x => ({ message: x.message }))
            )
          )
        ),
        T.map(() => {})
      )
    )
  );
}
