import * as T from "./effect";
import { pipe } from "fp-ts/lib/pipeable";
import { FunctionN } from "fp-ts/lib/function";
import { Cause } from "./original/exit";

export type Strip<R, R2> = R extends R2 & infer R3 ? R3 : R;

export class Fluent<R, E, A> {
  constructor(readonly t: T.Effect<R, E, A>) {}

  done: () => T.Effect<R, E, A> = () => this.t;

  chain: <R2, E2, A2>(
    f: (s: A) => T.Effect<R2, E2, A2>
  ) => Fluent<R & R2, E | E2, A2> = f => new Fluent(T.effect.chain(this.t, f));

  chainError: <R2, E2, A2>(
    f: (r: E) => T.Effect<R2, E2, A2>
  ) => Fluent<R & R2, E2, A | A2> = f =>
    new Fluent(T.effect.chainError(this.t, f));

  tap: <R2, E2, A2>(
    f: (s: A) => T.Effect<R2, E2, A2>
  ) => Fluent<R & R2, E | E2, A> = f =>
    new Fluent(T.effect.chainTap(this.t, f));

  provideS: <R2 extends Partial<R>>(r: R2) => Fluent<Strip<R, R2>, E, A> = r =>
    new Fluent(T.provideS(r)(this.t) as any);

  provide: (r: R) => Fluent<unknown, E, A> = r =>
    new Fluent(pipe(this.t, T.provideS(r)));

  foldExit: <R2, E2, A2, A3, R3, E3>(
    failure: FunctionN<[Cause<E>], T.Effect<R2, E2, A2>>,
    success: FunctionN<[A], T.Effect<R3, E3, A2>>
  ) => Fluent<R & R2 & R3, E2 | E3, A2 | A3> = (f, s) =>
    new Fluent(T.effect.foldExit(this.t, f, s));
}

export function fluent<R, E, A>(eff: T.Effect<R, E, A>): Fluent<R, E, A> {
  return new Fluent<R, E, A>(eff);
}
