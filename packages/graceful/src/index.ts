import { effect as T, freeEnv as F, ref as R } from "@matechs/effect";
import { array } from "fp-ts/lib/Array";
import { flow } from "fp-ts/lib/function";
import { pipe } from "fp-ts/lib/pipeable";

export const gracefulURI = "@matechs/graceful/gracefulURI";

const gracefulF_ = F.define({
  [gracefulURI]: {
    onExit: F.fn<(op: T.Task<void>) => T.Task<void>>(),
    trigger: F.cn<T.Task<void>>()
  }
});

export interface Graceful extends F.TypeOf<typeof gracefulF_> {}

export const gracefulF = F.opaque<Graceful>()(gracefulF_);

export const { onExit, trigger } = F.access(gracefulF)[gracefulURI];

const insert = <K>(_: K) => (a: K[]) => [...a, _];

export const provideGraceful = F.implementWith(R.makeRef<T.Task<void>[]>([]))(gracefulF)((_) => ({
  [gracefulURI]: {
    onExit: flow(insert, _.update, T.asUnit),
    trigger: pipe(_.get, T.chain(array.sequence(T.parEffect)), T.asUnit)
  }
}));
