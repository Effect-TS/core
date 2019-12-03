/*
  based on: https://github.com/rzeigler/waveguide/blob/master/src/driver.ts
 */

import { Either, fold as foldEither } from "fp-ts/lib/Either";
import { FunctionN, Lazy } from "fp-ts/lib/function";
import {
  Cause,
  Done,
  done,
  Exit,
  ExitTag,
  interrupt as interruptExit,
  raise
} from "./original/exit";
import { defaultRuntime, Runtime } from "./original/runtime";
import { NoEnv } from "./effect";
import * as T from "./effect";

// It turns out th is is used quite often
type UnkIO = T.Effect<unknown, unknown, unknown>;
type UnkEff = T.EffectIOImpl;

export type RegionFrameType = InterruptFrame;
export type FrameType = Frame | FoldFrame | RegionFrameType;

interface Frame {
  readonly _tag: "frame";
  apply(u: unknown): UnkIO;
}

const makeFrame = (f: FunctionN<[unknown], UnkIO>): Frame => ({
  _tag: "frame",
  apply: f
});

interface FoldFrame {
  readonly _tag: "fold-frame";
  apply(u: unknown): UnkIO;
  recover(cause: Cause<unknown>): UnkIO;
}

class FoldFrame implements FoldFrame {
  constructor(private readonly c: T.EffectIOImpl) {}
  readonly _tag = "fold-frame" as const;

  apply(u: unknown): UnkIO {
    return (this.c.f1 as any)(u);
  }
  recover(cause: Cause<unknown>): UnkIO {
    return (this.c.f2 as any)(cause);
  }
}

interface InterruptFrame {
  readonly _tag: "interrupt-frame";
  apply(u: unknown): UnkIO;
  exitRegion(): void;
}

const makeInterruptFrame = (interruptStatus: boolean[]): InterruptFrame => ({
  _tag: "interrupt-frame",
  apply(u: unknown) {
    interruptStatus.pop();
    return T.pure(u);
  },
  exitRegion() {
    interruptStatus.pop();
  }
});

export interface Driver<E, A> {
  start(run: T.Effect<T.NoEnv, E, A>): void;
  interrupt(): void;
  onExit(f: FunctionN<[Exit<E, A>], void>): Lazy<void>;
  completed: Exit<E, A> | null;
}

export class DriverImpl<E, A> implements Driver<E, A> {
  completed: Exit<E, A> | null = null;
  listeners: FunctionN<[Exit<E, A>], void>[] | undefined;

  started = false;
  interrupted = false;
  frameStack: FrameType[] = [];
  interruptRegionStack: boolean[] | undefined;
  isInterruptible_ = true;
  cancelAsync: Lazy<void> | undefined;
  envStack: any[] = [];

  constructor(readonly runtime: Runtime = defaultRuntime) {}

  set(a: Exit<E, A>): void {
    this.completed = a;
    if (this.listeners !== undefined) {
      this.listeners.forEach(f => f(a));
    }
  }

  isComplete(): boolean {
    return this.completed !== null;
  }
  complete(a: Exit<E, A>): void {
    if (this.completed !== null) {
      throw new Error("Die: Completable is already completed");
    }
    this.set(a);
  }
  tryComplete(a: Exit<E, A>): boolean {
    if (this.completed !== null) {
      return false;
    }
    this.set(a);
    return true;
  }

  onExit(f: FunctionN<[Exit<E, A>], void>): Lazy<void> {
    if (this.completed !== null) {
      f(this.completed);
    }
    if (this.listeners === undefined) {
      this.listeners = [f];
    } else {
      this.listeners.push(f);
    }
    return () => {
      if (this.listeners !== undefined) {
        this.listeners = this.listeners.filter(cb => cb !== f);
      }
    };
  }

  exit(): Exit<E, A> | null {
    return this.completed;
  }

  isInterruptible(): boolean {
    return this.interruptRegionStack !== undefined &&
      this.interruptRegionStack.length > 0
      ? this.interruptRegionStack[this.interruptRegionStack.length - 1]
      : true;
  }

  // canRecover(cause: Cause<unknown>): boolean {
  //   // It is only possible to recovery from interrupts in an uninterruptible region
  //   return cause._tag === ExitTag.Interrupt ? !this.isInterruptible() : true;
  // }

  handle(e: Cause<unknown>): UnkIO | undefined {
    let frame = this.frameStack.pop();
    while (frame) {
      if (
        frame._tag === "fold-frame" &&
        (e._tag !== ExitTag.Interrupt || !this.isInterruptible())
      ) {
        return frame.recover(e);
      }
      // We need to make sure we leave an interrupt region or environment provision region while unwinding on errors
      if (frame._tag === "interrupt-frame") {
        frame.exitRegion();
      }
      frame = this.frameStack.pop();
    }
    // At the end... so we have failed
    this.complete(e as Cause<E>);
    return;
  }

  resumeInterrupt(): void {
    this.runtime.dispatch(() => {
      const go = this.handle(interruptExit);
      if (go) {
        // eslint-disable-next-line
        this.loop(go);
      }
    });
  }

  next(value: unknown): UnkIO | undefined {
    const frame = this.frameStack.pop();
    if (frame) {
      return frame.apply(value);
    }
    this.complete(done(value) as Done<A>);
    return;
  }

  resume(status: Either<unknown, unknown>): void {
    this.cancelAsync = undefined;
    this.runtime.dispatch(() => {
      foldEither(
        (cause: unknown) => {
          const go = this.handle(raise(cause));
          if (go) {
            /* eslint-disable-next-line */
            this.loop(go);
          }
        },
        (value: unknown) => {
          const go = this.next(value);
          if (go) {
            /* eslint-disable-next-line */
            this.loop(go);
          }
        }
      )(status);
    });
  }

  contextSwitch(
    op: FunctionN<[FunctionN<[Either<unknown, unknown>], void>], Lazy<void>>
  ): void {
    let complete = false;
    const wrappedCancel = op(status => {
      if (complete) {
        return;
      }
      complete = true;
      this.resume(status);
    });
    this.cancelAsync = () => {
      complete = true;
      wrappedCancel();
    };
  }

  // tslint:disable-next-line: cyclomatic-complexity
  loop(go: UnkIO): void {
    let current: UnkIO | undefined = go;

    while (current && (!this.isInterruptible() || !this.interrupted)) {
      try {
        const cu = (current as any) as UnkEff;

        switch (cu._tag) {
          case T.EffectTag.Map:
            this.frameStack.push(
              makeFrame(a => T.sync(() => (cu.f1 as any)(a)))
            );
            current = cu.f0 as any;
            break;
          case T.EffectTag.AccessEnv:
            const env =
              this.envStack.length > 0
                ? this.envStack[this.envStack.length - 1]
                : {};
            current = this.next(env);
            break;
          case T.EffectTag.ProvideEnv:
            this.envStack.push(cu.f1 as any);
            current = T.effect.chainError(
              T.effect.chain(cu.f0 as UnkIO, r =>
                T.sync(() => {
                  this.envStack.pop();
                  return r;
                })
              ),
              e =>
                T.effect.chain(
                  T.sync(() => {
                    this.envStack.pop();
                    return {};
                  }),
                  _ => T.raiseError(e)
                )
            );
            break;
          case T.EffectTag.Pure:
            current = this.next(cu.f0);
            break;
          case T.EffectTag.Raised:
            if ((cu.f0 as Cause<unknown>)._tag === ExitTag.Interrupt) {
              this.interrupted = true;
            }
            current = this.handle(cu.f0 as Cause<unknown>);
            break;
          case T.EffectTag.Completed:
            const ex = cu.f0 as Exit<unknown, unknown>;
            if (ex._tag === ExitTag.Done) {
              current = this.next(ex.value);
            } else {
              current = this.handle(ex);
            }
            break;
          case T.EffectTag.Suspended:
            current = (cu.f0 as Lazy<UnkIO>)();
            break;
          case T.EffectTag.Async:
            this.contextSwitch(
              cu.f0 as FunctionN<
                [FunctionN<[Either<unknown, unknown>], void>],
                Lazy<void>
              >
            );
            current = undefined;
            break;
          case T.EffectTag.Chain:
            this.frameStack.push(
              makeFrame(
                cu.f1 as FunctionN<[any], T.Effect<unknown, unknown, unknown>>
              )
            );
            current = cu.f0 as UnkIO;
            break;
          case T.EffectTag.Collapse:
            this.frameStack.push(new FoldFrame(cu as any));
            current = cu.f0 as UnkIO;
            break;
          case T.EffectTag.InterruptibleRegion:
            if (this.interruptRegionStack === undefined) {
              this.interruptRegionStack = [cu.f0 as boolean];
            } else {
              this.interruptRegionStack.push(cu.f0 as boolean);
            }
            this.frameStack.push(makeInterruptFrame(this.interruptRegionStack));
            current = cu.f1 as UnkIO;
            break;
          case T.EffectTag.AccessRuntime:
            current = T.pure((cu.f0 as any)(this.runtime)) as UnkIO;
            break;
          case T.EffectTag.AccessInterruptible:
            current = T.pure(
              (cu.f0 as FunctionN<[boolean], UnkIO>)(this.isInterruptible())
            );
            break;
          default:
            throw new Error(`Die: Unrecognized current type ${current}`);
        }
      } catch (e) {
        current = T.raiseAbort(e) as UnkIO;
      }
    }
    // If !current then the interrupt came to late and we completed everything
    if (this.interrupted && current) {
      this.resumeInterrupt();
    }
  }

  start(run: T.Effect<NoEnv, E, A>): void {
    if (this.started) {
      throw new Error("Bug: Runtime may not be started multiple times");
    }
    this.started = true;
    this.runtime.dispatch(() => this.loop(run as UnkIO));
  }

  interrupt(): void {
    if (this.interrupted || this.isComplete()) {
      return;
    }
    this.interrupted = true;
    if (this.cancelAsync && this.isInterruptible()) {
      this.cancelAsync();
      this.resumeInterrupt();
    }
  }
}
