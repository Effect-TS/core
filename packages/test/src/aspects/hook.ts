import { pipe } from "fp-ts/lib/pipeable";
import { patch, AspectE, AspectR12 } from "../def";
import { effect as T } from "@matechs/effect";
import { Do } from "fp-ts-contrib/lib/Do";

export const withInit = <S, R>(init: T.Effect<S, R, any, void>): AspectE<R> => (Spec) =>
  pipe(
    Spec,
    patch((_) => ({
      ..._,
      _R: undefined as any,
      eff: T.effect.chain(init, () => _.eff)
    }))
  );

export const withFinalize = <S, R>(finalize: T.Effect<S, R, any, void>): AspectE<R> => (Spec) =>
  pipe(
    Spec,
    patch((_) => ({
      ..._,
      _R: undefined as any,
      eff: pipe(
        T.result(_.eff),
        T.chainTap(() => finalize),
        T.chain(T.completed)
      )
    }))
  );

export const withHook = <S, S2, R, R2, A>(
  init: T.Effect<S, R, any, A>,
  finalize: (_: A) => T.Effect<S2, R2, any, void>
): AspectE<R & R2> => (Spec) =>
  pipe(
    Spec,
    patch((_) => ({
      ..._,
      _R: undefined as any,
      eff: Do(T.effect)
        .bind("i", init)
        .bind("e", T.result(_.eff))
        .doL((s) => finalize(s.i))
        .bindL("r", (s) => T.completed(s.e))
        .return((s) => s.r)
    }))
  );

export const withHookP = <S, S2, R, R2, A>(
  init: T.Effect<S, R, any, A>,
  finalize: (_: A) => T.Effect<S2, R2, any, void>
): AspectR12<A, R & R2> => (Spec) =>
  pipe(
    Spec,
    patch((_) => ({
      ..._,
      _R: undefined as any,
      eff: Do(T.effect)
        .bind("i", init)
        .bindL("e", (s) => T.result(T.provide(s.i)(_.eff)))
        .doL((s) => finalize(s.i))
        .bindL("r", (s) => T.completed(s.e))
        .return((s) => s.r)
    }))
  );
