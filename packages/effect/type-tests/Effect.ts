import * as _ from "../src";
import { pipe } from "fp-ts/lib/pipeable";
import { ATypeOf, EnvOf } from "../src/overload";
import { Do } from "fp-ts-contrib/lib/Do";
import { semigroupString } from "fp-ts/lib/Semigroup";

_.pure(1); // $ExpectType Effect<unknown, never, number>

interface EnvA {
  envA: {
    foo: string;
  };
}

interface EnvB {
  envB: {
    foo: string;
  };
}

const fa = _.accessM(({ envA }: EnvA) => _.pure(envA.foo));
const fb = _.accessM(({ envB }: EnvB) => _.pure(envB.foo));

const program = _.effectMonad.chain(fa, _ => fb); // $ExpectType Effect<EnvA & EnvB, never, string>

const fae = _.accessM(({ envA }: EnvA) => _.raiseError(envA.foo));

_.effectMonad.chain(fae, _ => fb); // $ExpectType Effect<EnvA & EnvB, string, string>

_.provide<EnvA>({} as EnvA)(program); // $ExpectType Effect<EnvB, never, string>

const module = pipe(_.noEnv, _.mergeEnv({} as EnvB), _.mergeEnv({} as EnvA)); // $ExpectType EnvA & EnvB

_.provide(module)(program); // $ExpectType Effect<unknown, never, string>

interface Env1 {
  value: string;
}
interface Env2 {
  value2: string;
}
interface Env3 {
  value3: string;
}

export type UnionToIntersection2<U> = (U extends any
? (k: U) => void
: never) extends (k: infer I) => void
  ? I
  : never;

type UString = _.Effect<unknown, unknown, string>;
type Env1String = _.Effect<Env1, unknown, string>;
type Env2String = _.Effect<Env2, unknown, string>;
type NeverString = _.Effect<never, unknown, string>;
type R1 = EnvOf<{ a: Env1String; b: NeverString }>; // $ExpectType Env1
type R2 = EnvOf<{ a: Env1String; b: UString }>; // $ExpectType Env1
type R3 = EnvOf<{ a: NeverString; b: UString }>; // $ExpectType unknown
type R4 = EnvOf<{ a: Env1String; b: Env2String }>; // $ExpectType Env1 & Env2

type ATypeOfU = ATypeOf<UString>; // $ExpectType string
type ATypeOfO = ATypeOf<Env1String>; // $ExpectType string
type ATypeOfNever = ATypeOf<NeverString>; // $ExpectType string

const M = _.effectMonad;
const doAErr = Do(M) // $ExpectType Effect<Env2 & Env1, unknown, { x: string; } & { a: never; b: never; }>
  .bindL("x", () => _.accessM(({}: Env2) => M.of("a")))
  .sequenceS({
    a: _.accessM(({}: Env1) => M.throwError("a")),
    b: M.throwError("b")
  })
  .return(r => r);

const doA = Do(M) // $ExpectType Effect<Env2 & Env1, unknown, { x: string; } & { a: string; b: number; }>
  .bindL("x", () => _.accessM(({}: Env2) => M.of("a")))
  .sequenceS({
    a: _.accessM(({}: Env1) => M.of("a")),
    b: M.of(2)
  })
  .return(r => r);

const doB = Do(M) // $ExpectType Effect<unknown, unknown, { x: string; } & { a: never; b: never; }>
  .bindL("x", () => M.of("a"))
  .sequenceS({
    a: M.throwError("a"),
    b: M.throwError("b")
  })
  .return(r => r);

const doC = Do(M) // $ExpectType Effect<Env2 & Env1 & Env3, unknown, { x: string; } & { a: never; b: never; }>
  .bindL("x", () => _.accessM(({}: Env2) => M.of("a")))
  .sequenceS({
    a: _.accessM(({}: Env1) => M.throwError("a")),
    b: _.accessM(({}: Env3) => M.throwError("b"))
  })
  .return(r => r);

const M2 = _.getValidationM(semigroupString);

const doA2 = Do(M2) // $ExpectType Effect<Env2 & Env1, string, { x: string; } & { a: never; b: never; }>
  .bindL("x", () => _.accessM(({}: Env2) => M.of("a")))
  .sequenceS({
    a: _.accessM(({}: Env1) => M.throwError("a")),
    b: M.throwError("b")
  })
  .return(r => r);

const doB2 = Do(M2) // $ExpectType Effect<unknown, string, { x: string; } & { a: never; b: never; }>
  .bindL("x", () => M.of("a"))
  .sequenceS({
    a: M.throwError("a"),
    b: M.throwError("b")
  })
  .return(r => r);

const doC2 = Do(M2) // $ExpectType Effect<Env2 & Env1 & Env3, string, { x: string; } & { a: never; b: never; }>
  .bindL("x", () => _.accessM(({}: Env2) => M.of("a")))
  .sequenceS({
    a: _.accessM(({}: Env1) => M.throwError("a")),
    b: _.accessM(({}: Env3) => M.throwError("b"))
  })
  .return(r => r);
