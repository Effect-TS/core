/*
  based on: https://github.com/rzeigler/waveguide/blob/master/src/ticket.ts
  credits to original author
 */

import * as T from "./";
import { Exit, ExitTag } from "waveguide/lib/exit";

export function ticketExit<A>(
  ticket: Ticket<A>,
  exit: Exit<never, A>
): T.Stack<T.NoEnv, T.NoErr, void> {
  if (exit._tag === ExitTag.Interrupt) {
    return ticket.cleanup;
  }
  return T.unit;
}

export function ticketUse<A>(ticket: Ticket<A>): T.Stack<T.NoEnv, T.NoErr, A> {
  return ticket.acquire;
}

export interface Ticket<A> {
  readonly acquire: T.Stack<T.NoEnv, T.NoErr, A>;
  readonly cleanup: T.Stack<T.NoEnv, T.NoErr, void>;
}

export function makeTicket<A>(
  acquire: T.Stack<T.NoEnv, T.NoErr, A>,
  cleanup: T.Stack<T.NoEnv, T.NoErr, void>
): Ticket<A> {
  return {
    acquire,
    cleanup
  };
}
