import type { NonEmptyArray } from "../NonEmptyArray"
import type { Option } from "../Option"
import type { Effect, Managed, Stream, StreamEither } from "../Support/Common/types"

import type { Cause, Exit, Interrupt } from "./Exit"
import { fold_ } from "./fold_"

export function fold<
  S1,
  S2,
  S3,
  S4,
  E,
  A,
  B1,
  B2,
  B3,
  B4,
  R1,
  E1,
  R2,
  E2,
  R3,
  E3,
  R4,
  E4
>(
  onDone: (v: A) => Effect<S1, R1, E1, B1>,
  onRaise: (
    v: E,
    remaining: Option<NonEmptyArray<Cause<any>>>
  ) => Effect<S2, R2, E2, B2>,
  onAbort: (
    v: unknown,
    remaining: Option<NonEmptyArray<Cause<any>>>
  ) => Effect<S3, R3, E3, B3>,
  onInterrupt: (i: Interrupt) => Effect<S4, R4, E4, B4>
): (
  e: Exit<E, A>
) => Effect<S1 | S2 | S3 | S4, R1 & R2 & R3 & R4, E1 | E2 | E3 | E4, B1 | B2 | B3 | B4>
export function fold<
  S1,
  S2,
  S3,
  S4,
  E,
  A,
  B1,
  B2,
  B3,
  B4,
  R1,
  E1,
  R2,
  E2,
  R3,
  E3,
  R4,
  E4
>(
  onDone: (v: A) => Managed<S1, R1, E1, B1>,
  onRaise: (
    v: E,
    remaining: Option<NonEmptyArray<Cause<any>>>
  ) => Managed<S2, R2, E2, B2>,
  onAbort: (
    v: unknown,
    remaining: Option<NonEmptyArray<Cause<any>>>
  ) => Managed<S3, R3, E3, B3>,
  onInterrupt: (i: Interrupt) => Managed<S4, R4, E4, B4>
): (
  e: Exit<E, A>
) => Managed<S1 | S2 | S3 | S4, R1 & R2 & R3 & R4, E1 | E2 | E3 | E4, B1 | B2 | B3 | B4>
export function fold<
  S1,
  S2,
  S3,
  S4,
  E,
  A,
  B1,
  B2,
  B3,
  B4,
  R1,
  E1,
  R2,
  E2,
  R3,
  E3,
  R4,
  E4
>(
  onDone: (v: A) => Stream<S1, R1, E1, B1>,
  onRaise: (
    v: E,
    remaining: Option<NonEmptyArray<Cause<any>>>
  ) => Stream<S2, R2, E2, B2>,
  onAbort: (
    v: unknown,
    remaining: Option<NonEmptyArray<Cause<any>>>
  ) => Stream<S3, R3, E3, B3>,
  onInterrupt: (i: Interrupt) => Stream<S4, R4, E4, B4>
): (
  e: Exit<E, A>
) => Stream<S1 | S2 | S3 | S4, R1 & R2 & R3 & R4, E1 | E2 | E3 | E4, B1 | B2 | B3 | B4>
export function fold<
  S1,
  S2,
  S3,
  S4,
  E,
  A,
  B1,
  B2,
  B3,
  B4,
  R1,
  E1,
  R2,
  E2,
  R3,
  E3,
  R4,
  E4
>(
  onDone: (v: A) => StreamEither<S1, R1, E1, B1>,
  onRaise: (
    v: E,
    remaining: Option<NonEmptyArray<Cause<any>>>
  ) => StreamEither<S2, R2, E2, B2>,
  onAbort: (
    v: unknown,
    remaining: Option<NonEmptyArray<Cause<any>>>
  ) => StreamEither<S3, R3, E3, B3>,
  onInterrupt: (i: Interrupt) => StreamEither<S4, R4, E4, B4>
): (
  e: Exit<E, A>
) => StreamEither<
  S1 | S2 | S3 | S4,
  R1 & R2 & R3 & R4,
  E1 | E2 | E3 | E4,
  B1 | B2 | B3 | B4
>
export function fold<E, A, B1, B2, B3, B4>(
  onDone: (v: A) => B1,
  onRaise: (v: E, remaining: Option<NonEmptyArray<Cause<any>>>) => B2,
  onAbort: (v: unknown, remaining: Option<NonEmptyArray<Cause<any>>>) => B3,
  onInterrupt: (i: Interrupt) => B4
): (e: Exit<E, A>) => B1 | B2 | B3 | B4
export function fold<E, A, B>(
  onDone: (v: A) => B,
  onRaise: (v: E, remaining: Option<NonEmptyArray<Cause<any>>>) => B,
  onAbort: (v: unknown, remaining: Option<NonEmptyArray<Cause<any>>>) => B,
  onInterrupt: (i: Interrupt) => B
): (e: Exit<E, A>) => B {
  return (e) => fold_(e, onDone, onRaise, onAbort, onInterrupt)
}
