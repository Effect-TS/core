import { T, A, pipe } from "@matechs/prelude";
import { print, Printer } from "./Printer";
import { withChildSpan } from "../../src";

export const CounterState: unique symbol = Symbol();

export interface CounterState {
  [CounterState]: {
    ref: number;
    increment(): T.SyncR<CounterState, void>;
  };
}

export function currentCount() {
  return T.accessM(({ [CounterState]: counter }: CounterState) => T.pure(counter.ref));
}

export const counterState = T.provideM(
  T.sync(
    (): CounterState => ({
      [CounterState]: {
        ref: 0,
        increment() {
          return T.accessM((s: CounterState) =>
            T.sync(() => {
              s[CounterState].ref += 1;
            })
          );
        }
      }
    })
  )
);

export const Counter: unique symbol = Symbol();

export interface Counter {
  [Counter]: {
    count(): T.SyncRE<Printer & CounterState, Error, void[]>;
  };
}

export const counter: Counter = {
  [Counter]: {
    count() {
      return pipe(
        A.range(1, 10),
        T.traverseArray((n) =>
          T.Do()
            .do(increment())
            .bind("count", withChildSpan("span-current-count")(currentCount()))
            .doL(({ count }) => print(`n: ${n} (${count})`))
            .return(() => {})
        )
      );
    }
  }
};

export function increment(): T.SyncR<CounterState, void> {
  return T.accessM(({ [CounterState]: counter }: CounterState) => counter.increment());
}

export function count(): T.SyncRE<Counter & Printer & CounterState, Error, void[]> {
  return T.accessM(({ [Counter]: counter }: Counter) => counter.count());
}
