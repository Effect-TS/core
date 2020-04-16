import {
  effect as T,
  managed as M,
  exit as E,
  stream as S,
  streameither as SE
} from "@matechs/effect";
import * as Rx from "rxjs";
import { identity } from "fp-ts/lib/function";

export function encaseObservable<E, A>(
  observable: Rx.Observable<A>,
  onError: (e: any) => E
): S.StreamAsync<unknown, E, A> {
  return S.fromSource(
    M.managed.chain(
      M.bracket(
        T.sync(() => {
          const { next, ops, hasCB } = S.su.queueUtils<E, A>();

          return {
            s: observable.subscribe(
              (a) => next({ _tag: "offer", a }),
              (e) => next({ _tag: "error", e: onError(e) }),
              () => next({ _tag: "complete" })
            ),
            ops,
            hasCB
          };
        }),
        ({ s }) => T.sync(() => s.unsubscribe())
      ),
      ({ ops, hasCB }) => S.su.emitter(ops, hasCB)
    )
  );
}

export function encaseObservableEither<A, E = unknown>(
  observable: Rx.Observable<A>,
  mapError: (_: any) => E = identity
): SE.StreamEitherAsync<unknown, E, A> {
  return SE.fromSource(
    M.managed.chain(
      M.bracket(
        T.sync(() => {
          const { next, ops, hasCB } = S.su.queueUtils<E, A>();

          return {
            s: observable.subscribe(
              (a) => next({ _tag: "offer", a: a }),
              (e) => next({ _tag: "error", e: mapError(e) }),
              () => next({ _tag: "complete" })
            ),
            ops,
            hasCB
          };
        }),
        ({ s }) => T.sync(() => s.unsubscribe())
      ),
      ({ ops, hasCB }) => S.su.emitter(ops, hasCB)
    )
  );
}

export function runToObservable<A>(
  o: T.Task<Rx.Observable<A>>
): Rx.Observable<A> {
  return new Rx.Observable((sub) => {
    T.run(
      o,
      E.fold(
        (ob) => {
          const running = ob.subscribe(
            (r) => {
              sub.next(r);
            },
            (e) => {
              sub.error(e);
            },
            () => {
              sub.complete();
            }
          );

          sub.unsubscribe = () => {
            running.unsubscribe();
            sub.closed = true;
          };
        },
        (e) => {
          /* istanbul ignore next */
          sub.error(e);
        },
        (u) => {
          /* istanbul ignore next */
          sub.error(u);
        },
        () => {
          /* istanbul ignore next */
          sub.error(new Error("interrupted"));
        }
      )
    );
  });
}

export function toObservable<R, E, A>(
  s: S.Stream<R, E, A>
): T.EffectEnv<R, Rx.Observable<A>> {
  return T.access(
    (r: R) =>
      new Rx.Observable((sub) => {
        const drainer = T.provide(r)(
          S.drain(
            S.stream.mapM(s, (a) =>
              T.sync(() => {
                sub.next(a);
              })
            )
          )
        );
        const interruptDrain = T.run(
          drainer,
          E.fold(
            () => {
              sub.complete();
            },
            (e) => {
              sub.error(e);
              sub.unsubscribe();
            },
            (u) => {
              sub.error(u);
              sub.unsubscribe();
            },
            // tslint:disable-next-line: no-empty
            () => {}
          )
        );

        sub.unsubscribe = () => {
          sub.closed = true;
          interruptDrain();
        };
      })
  );
}
