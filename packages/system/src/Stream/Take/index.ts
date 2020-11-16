import * as A from "../../Array"
import * as C from "../../Cause/core"
import * as E from "../../Exit/api"
import { pipe } from "../../Function"
import * as O from "../../Option"
import * as T from "../_internal/effect"
import type { Pull } from "../Pull"

export type Take<E, A> = E.Exit<O.Option<E>, A.Array<A>>

export const chunk = <A>(as: A.Array<A>): Take<never, A> => E.succeed(as)

export const halt = <E>(cause: C.Cause<E>): Take<E, never> =>
  E.halt(pipe(cause, C.map(O.some)))

export const end: Take<never, never> = E.fail(O.none)

export const done = <E, A>(take: Take<E, A>) => T.done(take)

export const fromPull = <R, E, O>(
  pull: Pull<R, E, O>
): T.Effect<R, never, Take<E, O>> =>
  pipe(
    pull,
    T.foldCause(
      (c) =>
        pipe(
          C.sequenceCauseOption(c),
          O.fold(() => end, halt)
        ),
      chunk
    )
  )
