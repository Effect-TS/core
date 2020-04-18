import {
  effect as T,
  freeEnv as Service,
  managed as M,
  stream as S,
  streameither as SE,
  concurrentRef as CRef,
  queue as Q,
  rec as Rec,
  retry as RT,
  ref as Ref,
  semaphore as Sem,
  utils as U
} from "@matechs/effect";
import * as F from "fp-ts/lib/function";
import * as eq from "fp-ts/lib/Eq";
import * as show from "fp-ts/lib/Show";
import * as semigroup from "fp-ts/lib/Semigroup";
import * as monoid from "fp-ts/lib/Monoid";
import * as map from "fp-ts/lib/Map";
import * as set from "fp-ts/lib/Set";
import * as tree from "fp-ts/lib/Tree";
import * as magma from "fp-ts/lib/Magma";
import * as E from "./either";
import * as A from "fp-ts/lib/Array";
import * as O from "./option";
import * as Ex from "./exit";
import * as MIO from "./simple/mio";

export { pipe } from "fp-ts/lib/pipeable";

export { T, S, SE, M, O, CRef, Q, Rec, RT, Ref, Sem, U, MIO };
export { Ex };
export { E };
export { Service };
export { F };
export { A };
export { eq, show, semigroup, monoid, tree, map, set, magma };

export class Pipe<A> {
  constructor(private readonly _: A) {
    this.pipe = this.pipe.bind(this);
    this.done = this.done.bind(this);
  }
  pipe<B>(f: (_: A) => B) {
    return new Pipe(f(this._));
  }
  done(): A {
    return this._;
  }
}

export class Flow<A extends ReadonlyArray<unknown>, B> {
  constructor(private readonly f: (...a: A) => B) {
    this.flow = this.flow.bind(this);
    this.done = this.done.bind(this);
  }
  flow<C>(g: (_: B) => C) {
    return new Flow((...a: A) => g(this.f(...a)));
  }
  done(): (...a: A) => B {
    return this.f;
  }
}

export const pipeF = <A>(_: A) => new Pipe(_);
export const flowF = <A extends ReadonlyArray<unknown>, B>(f: (...a: A) => B) => new Flow(f);

export type CombineNeeds<N, P, N2> = N & P extends P & infer Q ? Q & N2 : N & P & N2;

export class FlowP<Need, Prov, AddE, Op> {
  constructor(private readonly f?: any) {
    this.with = this.with.bind(this);
    this.done = this.done.bind(this);
  }

  with<Need2, Prov2, Err2, Op2>(
    _: T.Provider<Need2, Prov2, Err2, Op2>
  ): FlowP<CombineNeeds<Need, Prov2, Need2>, Prov & Prov2, AddE | Err2, Op | Op2> {
    return new FlowP((x: any) => (_ as any)(this.f(x))) as any;
  }

  done(): T.Provider<Need, Prov, AddE, Op> {
    return this.f;
  }
}

export function combineProviders() {
  return new FlowP<unknown, unknown, never, never>((x: any) => x);
}
