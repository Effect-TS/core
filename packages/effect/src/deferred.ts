/*
  based on: https://github.com/rzeigler/waveguide/blob/master/src/deferred.ts
  credits to original author
  small adaptations to extend Monad3E and support contravariance on R
 */

import { Exit, Cause } from "waveguide/lib/exit";
import { Wave } from "waveguide/lib/wave";
import * as io from "waveguide/lib/wave";
import { Completable, completable } from "waveguide/lib/support/completable";
import * as T from "./";

export interface Deferred<R, E, A> {
  /**
   * Wait for this deferred to complete.
   *
   * This effect will produce the value set by done, raise the error set by error or interrupt
   */
  readonly wait: T.Effect<R, E, A>;
  /**
   * Interrupt any waitersa on this Deferred
   */
  interrupt: T.Effect<T.NoEnv, T.NoErr, void>;
  /**
   * Complete this Deferred with a value
   *
   * Any waiters will receive it
   * @param a
   */
  done(a: A): T.Effect<T.NoEnv, T.NoErr, void>;
  /**
   *
   * @param e Complete this deferred with an error
   *
   * Any waiters will produce an error
   */
  error(e: E): T.Effect<T.NoEnv, T.NoErr, void>;

  /**
   * Complete this Deferred with an abort
   *
   * Any waiters will produce an error
   * @param e
   */
  abort(e: unknown): T.Effect<T.NoEnv, T.NoErr, void>;

  /**
   * Complete this deferred with the given cuase
   * @param c
   */
  cause(c: Cause<E>): T.Effect<T.NoEnv, T.NoErr, void>;

  /**
   * complete this Defered with the provide exit status
   * @param e
   */
  complete(e: Exit<E, A>): T.Effect<T.NoEnv, T.NoErr, void>;

  /**
   * Set this deferred with the result of source
   * @param source
   */
  from(source: T.Effect<R, E, A>): T.Effect<T.NoEnv, T.NoErr, void>;
}

/* tested in wave */
/* istanbul ignore next */
export function makeDeferred<R, E, A, E2 = never>(): T.Effect<
  R,
  E2,
  Deferred<R, E, A>
> {
  return _ =>
    io.sync(() => {
      const c: Completable<Wave<E, A>> = completable();
      const wait = _ =>
        io.flatten(
          io.asyncTotal<Wave<E, A>>(callback => c.listen(callback))
        );
      const interrupt = _ =>
        io.sync(() => {
          c.complete(io.raiseInterrupt);
        });
      const done = (a: A): T.Effect<T.NoEnv, T.NoErr, void> => _ =>
        io.sync(() => {
          c.complete(io.pure(a));
        });
      const error = (e: E): T.Effect<T.NoEnv, T.NoErr, void> => _ =>
        io.sync(() => {
          c.complete(io.raiseError(e));
        });
      const abort = (e: unknown): T.Effect<T.NoEnv, T.NoErr, void> => _ =>
        io.sync(() => {
          c.complete(io.raiseAbort(e));
        });
      const cause = (e: Cause<E>): T.Effect<T.NoEnv, T.NoErr, void> => _ =>
        io.sync(() => {
          c.complete(io.raised(e));
        });
      const complete = (
        exit: Exit<E, A>
      ): T.Effect<T.NoEnv, T.NoErr, void> => _ =>
        io.sync(() => {
          c.complete(io.completed(exit));
        });
      const from = (
        source: T.Effect<R, E, A>
      ): T.Effect<T.NoEnv, T.NoErr, void> => {
        const completed = r =>
          io.chain<never, Exit<E, A>, void>(io.result(source(r)), x =>
            complete(x)(r)
          );
        const interruptor = interrupt as T.Effect<T.NoEnv, T.NoErr, void>;
        return r => io.onInterrupted(completed(r), interruptor(r));
      };
      return {
        wait,
        interrupt,
        done,
        error,
        abort,
        cause,
        complete,
        from
      };
    });
}
