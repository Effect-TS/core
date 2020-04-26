/*
  based on: https://github.com/rzeigler/waveguide/blob/master/src/driver.ts
 */

import { either as E, function as F } from "fp-ts";
import {
  Cause,
  Done,
  done,
  Exit,
  interruptWithError,
  raise,
  interruptWithErrorAndOthers
} from "./original/exit";
import { defaultRuntime } from "./original/runtime";
import * as T from "./effect";
import { DoublyLinkedList } from "./listc";

export type RegionFrameType = InterruptFrame;
export type FrameType = Frame | FoldFrame | RegionFrameType | MapFrame;

export class Frame implements Frame {
  constructor(
    readonly apply: (u: unknown) => T.Instructions,
    readonly prev: FrameType | undefined
  ) {}
}

export class FoldFrame implements FoldFrame {
  constructor(
    readonly apply: (u: unknown) => T.Instructions,
    readonly recover: (cause: Cause<unknown>) => T.Instructions,
    readonly prev: FrameType | undefined
  ) {}
}

export class MapFrame implements MapFrame {
  constructor(readonly apply: (u: unknown) => unknown, readonly prev: FrameType | undefined) {}
}

export class InterruptFrame {
  constructor(readonly interruptStatus: boolean[], readonly prev: FrameType | undefined) {}
  apply(u: unknown) {
    this.interruptStatus.pop();
    return new T.Pure(u);
  }
  exitRegion() {
    this.interruptStatus.pop();
  }
}

export interface Driver<E, A> {
  start(run: T.AsyncE<E, A>): void;
  interrupt(): void;
  onExit(f: F.FunctionN<[Exit<E, A>], void>): F.Lazy<void>;
  completed: Exit<E, A> | null;
}

export class DriverImpl<E, A> implements Driver<E, A> {
  completed: Exit<E, A> | null = null;
  listeners: F.FunctionN<[Exit<E, A>], void>[] | undefined;
  interrupted = false;
  currentFrame: FrameType | undefined = undefined;
  interruptRegionStack: boolean[] | undefined;
  cancelAsync: T.AsyncCancelContFn | undefined;
  envStack = new DoublyLinkedList<any>();

  set(a: Exit<E, A>): void {
    this.completed = a;
    if (this.listeners !== undefined) {
      for (const f of this.listeners) {
        f(a);
      }
    }
  }

  isComplete(): boolean {
    return this.completed !== null;
  }

  complete(a: Exit<E, A>): void {
    /* istanbul ignore if */
    if (this.completed !== null) {
      throw new Error("Die: Completable is already completed");
    }
    this.set(a);
  }

  onExit(f: F.FunctionN<[Exit<E, A>], void>): F.Lazy<void> {
    if (this.completed !== null) {
      f(this.completed);
    }
    if (this.listeners === undefined) {
      this.listeners = [f];
    } else {
      this.listeners.push(f);
    }
    // TODO: figure how to trigger if possible
    /* istanbul ignore next */
    return () => {
      if (this.listeners !== undefined) {
        this.listeners = this.listeners.filter((cb) => cb !== f);
      }
    };
  }

  exit(): Exit<E, A> | null {
    return this.completed;
  }

  isInterruptible(): boolean {
    return this.interruptRegionStack !== undefined && this.interruptRegionStack.length > 0
      ? this.interruptRegionStack[this.interruptRegionStack.length - 1]
      : true;
  }

  handle(e: Cause<unknown>): T.Instructions | undefined {
    let frame = this.currentFrame;
    this.currentFrame = this.currentFrame?.prev;
    while (frame) {
      if (frame instanceof FoldFrame && (e._tag !== "Interrupt" || !this.isInterruptible())) {
        return frame.recover(e);
      }
      // We need to make sure we leave an interrupt region or environment provision region while unwinding on errors
      if (frame instanceof InterruptFrame) {
        frame.exitRegion();
      }
      frame = this.currentFrame;
      this.currentFrame = this.currentFrame?.prev;
    }
    // At the end... so we have failed
    this.complete(e as Cause<E>);
    return;
  }

  dispatchResumeInterrupt(_: { err?: Error; others?: Error[] }) {
    const go =
      _.others && _.err
        ? this.handle(interruptWithErrorAndOthers(_.err, _.others))
        : this.handle(interruptWithError(_.err));
    if (go) {
      // eslint-disable-next-line
      this.loop(go);
    }
  }

  resumeInterrupt(err?: Error, others?: Error[]): void {
    defaultRuntime.dispatch(this.dispatchResumeInterrupt.bind(this), { err, others });
  }

  next(value: unknown): T.Instructions | undefined {
    const frame = this.currentFrame;
    this.currentFrame = this.currentFrame?.prev;

    if (frame) {
      if (frame instanceof MapFrame) {
        if (this.currentFrame === undefined) {
          this.complete(done(frame.apply(value)) as Done<A>);
          return;
        }
        return new T.Pure(frame.apply(value));
      } else {
        return frame.apply(value);
      }
    }
    this.complete(done(value) as Done<A>);
    return;
  }

  foldResume(status: E.Either<unknown, unknown>) {
    if (status._tag === "Right") {
      const go = this.next(status.right);
      if (go) {
        /* eslint-disable-next-line */
        this.loop(go);
      }
    } else {
      const go = this.handle(raise(status.left));
      if (go) {
        /* eslint-disable-next-line */
        this.loop(go);
      }
    }
  }

  resume(status: E.Either<unknown, unknown>): void {
    this.cancelAsync = undefined;
    defaultRuntime.dispatch(this.foldResume.bind(this), status);
  }

  contextSwitch(op: T.AsyncFn<unknown, unknown>): void {
    let complete = false;
    const wrappedCancel = op((status) => {
      if (complete) {
        return;
      }
      complete = true;
      this.resume(status);
    });
    this.cancelAsync = (cb) => {
      complete = true;
      wrappedCancel((err) => {
        cb(err);
      });
    };
  }

  IAccessEnv(_: T.IAccessEnv<any>) {
    const env = !this.envStack.empty() ? this.envStack.tail!.value : {};
    return this.next(env);
  }

  IProvideEnv(_: T.IProvideEnv<any, any, any, any>) {
    this.envStack.append(_.r as any);
    return (
      T.effect.foldExit(
        _.e as any,
        (e) =>
          T.effect.chain(
            T.sync(() => {
              this.envStack.deleteTail();
              return {};
            }),
            (_) => T.raised(e)
          ),
        (r) =>
          T.sync(() => {
            this.envStack.deleteTail();
            return r;
          })
      ) as any
    );
  }

  Pure(_: T.Pure<A>) {
    return this.next(_.a);
  }

  PureOption(_: T.PureOption<any, any>) {
    if (_.a._tag === "Some") {
      return this.next(_.a.value);
    } else {
      return this.handle(raise(_.onEmpty()));
    }
  }

  PureEither(_: T.PureEither<any, any>) {
    if (_.a._tag === "Right") {
      return this.next(_.a.right);
    } else {
      return this.handle(raise(_.a.left));
    }
  }

  Raised(_: T.Raised<any>) {
    if (_.e._tag === "Interrupt") {
      this.interrupted = true;
    }
    return this.handle(_.e);
  }

  Completed(_: T.Completed<any, any>) {
    if (_.e._tag === "Done") {
      return this.next(_.e.value);
    } else {
      return this.handle(_.e);
    }
  }

  Suspended(_: T.Suspended<any, any, any, any>) {
    return _.e();
  }

  IAsync(_: T.IAsync<any, any>) {
    this.contextSwitch(_.e);
    return undefined;
  }

  IChain(_: T.IChain<any, any, any, any, any, any, any, any>) {
    this.currentFrame = new Frame(_.f as any, this.currentFrame);
    return _.e as any;
  }

  IMap(_: T.IMap<any, any, any, any, any>) {
    this.currentFrame = new MapFrame(_.f, this.currentFrame);
    return _.e as any;
  }

  ICollapse(_: T.ICollapse<any, any, any, any, any, any, any, any, any, any, any, any>) {
    this.currentFrame = new FoldFrame(_.success as any, _.failure as any, this.currentFrame);
    return _.inner as any;
  }

  IInterruptibleRegion(_: T.IInterruptibleRegion<any, any, any, any>) {
    if (this.interruptRegionStack === undefined) {
      this.interruptRegionStack = [_.int];
    } else {
      this.interruptRegionStack.push(_.int);
    }
    this.currentFrame = new InterruptFrame(this.interruptRegionStack, this.currentFrame);
    return _.e as any;
  }

  IAccessRuntime(_: T.IAccessRuntime<any>) {
    return new T.Pure(_.f(defaultRuntime));
  }

  IAccessInterruptible(_: T.IAccessInterruptible<any>) {
    return new T.Pure(_.f(this.isInterruptible()));
  }

  // tslint:disable-next-line: cyclomatic-complexity
  loop(go: T.Instructions): void {
    let current: T.Instructions | undefined = go;

    while (current && (!this.interrupted || !this.isInterruptible())) {
      try {
        current = this[current.tag()](current as any);
      } catch (e) {
        current = new T.Raised({ _tag: "Abort", abortedWith: e });
      }
    }

    // If !current then the interrupt came to late and we completed everything
    if (this.interrupted && current) {
      this.resumeInterrupt();
    }
  }

  start(run: T.AsyncRE<{}, E, A>): void {
    defaultRuntime.dispatch(this.loop.bind(this), run as any);
  }

  interrupt(): void {
    if (this.interrupted || this.isComplete()) {
      return;
    }
    this.interrupted = true;
    if (this.cancelAsync && this.isInterruptible()) {
      this.cancelAsync((err, others) => {
        this.resumeInterrupt(err, others);
      });
    }
  }
}
