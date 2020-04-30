import {
  MaURIS,
  Monad4E,
  STypeOf,
  RTypeOf,
  ETypeOf,
  UnionToIntersection,
  ATypeOf,
  Monad4EP
} from "./overloadEff";
import { Kind4 } from "fp-ts/lib/HKT";
import { sequenceS } from "fp-ts/lib/Apply";

declare type EnforceNonEmptyRecord<R> = keyof R extends never ? never : R;

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

export class ForImpl<U extends MaURIS, S, R, E, A> {
  constructor(private readonly M: Monad4E<U>, private readonly res: Kind4<U, any, any, any, any>) {}
  with<N extends string>(n: Exclude<N, keyof A>) {
    return <S2, R2, E2, A2>(f: (_: A) => Kind4<U, S2, R2, E2, A2>) =>
      new ForImpl<U, S | S2, R & R2, E | E2, A & { [k in N]: A2 }>(
        this.M,
        this.M.chain(this.res, (k) => this.M.map(f(k), (_) => ({ ...k, [n]: _ })))
      );
  }
  withPipe<N extends string>(n: Exclude<N, keyof A>) {
    return <S2, R2, E2, A2>(f: (_: Pipe<A>) => Kind4<U, S2, R2, E2, A2>) =>
      new ForImpl<U, S | S2, R & R2, E | E2, A & { [k in N]: A2 }>(
        this.M,
        this.M.chain(this.res, (k) => this.M.map(f(new Pipe(k)), (_) => ({ ...k, [n]: _ })))
      );
  }
  let<N extends string>(n: Exclude<N, keyof A>) {
    return <A2>(f: (_: A) => A2) =>
      new ForImpl<U, S, R, E, A & { [k in N]: A2 }>(
        this.M,
        this.M.map(this.res, (k) => ({ ...k, [n]: f(k) }))
      );
  }
  all<NER extends Record<string, Kind4<U, any, any, any, any>>>(
    f: (_: A) => EnforceNonEmptyRecord<NER> & { [K in keyof A]?: never }
  ): ForImpl<
    U,
    S | { [k in keyof NER]: STypeOf<NER[k]> }[keyof NER],
    R & UnionToIntersection<{ [k in keyof NER]: RTypeOf<NER[k]> }[keyof NER]>,
    E | { [k in keyof NER]: ETypeOf<NER[k]> }[keyof NER],
    A & { [k in keyof NER]: ATypeOf<NER[k]> }
  > {
    return new ForImpl(
      this.M,
      this.M.chain(this.res, (k) =>
        this.M.map(sequenceS(this.M)(f(k) as any), (_) => ({ ...k, ..._ }))
      )
    );
  }
  pipe<S2, R2, E2, A2>(f: (_: Kind4<U, S, R, E, A>) => Kind4<U, S2, R2, E2, A2>) {
    return new ForImpl<U, S2, R2, E2, A2>(this.M, f(this.res));
  }
  return<A2>(f: (_: A) => A2): Kind4<U, S, R, E, A2> {
    return this.M.map(this.res, f);
  }
  unit(): Kind4<U, S, R, E, void> {
    return this.M.map(this.res, () => {
      //
    });
  }
  done(): Kind4<U, S, R, E, A> {
    return this.res;
  }
}

export function ForM<U extends MaURIS>(_: Monad4EP<U>): ForImpl<U, unknown, unknown, never, {}>;
export function ForM<U extends MaURIS>(_: Monad4E<U>): ForImpl<U, never, unknown, never, {}>;
export function ForM<U extends MaURIS>(_: unknown): unknown {
  return new ForImpl<U, never, unknown, never, {}>(_ as any, (_ as any).of({}) as any);
}
