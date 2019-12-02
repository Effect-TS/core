import { effect as T } from "@matechs/effect";
import { Tracer } from "@matechs/tracing";

/*
  this is an alternative way to provide a fake module definition that
  can be used for client & server utility generation, in the classical approach
  you would generate client from server module definition but this while
  being more in line with traditional module definition impose a dependency
  between client and server that you might not want (depending on how you
  structure your app)
 */

export const printerDef = {
  printer: {
    print: {} as (s: string) => T.Effect<T.NoEnv, T.NoErr, void>
  }
};

export type Printer = typeof printerDef;

// prettier-ignore
export const moduleADef = {
  moduleA: {
    notFailing: {} as (s: string) => T.Effect<Printer & Tracer, Error, string>,
    failing: {} as (s: string) => T.Effect<T.NoEnv, Error, string>
  }
};

export type ModuleA = typeof moduleADef;
