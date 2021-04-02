import { identity } from "../../Function"
import * as O from "../../Option"
import * as L from "../../Persistent/List"
import type { Conduit } from "../Conduit/index"
import * as Pipe from "../Pipe"

/**
 * Consumes a stream of input values and produces a final result, without
 * producing any output.
 */
export type Sink<R, E, I, A> = Conduit<R, E, I, never, A>

function sinkListGo<A>(
  front: (_: L.List<A>) => L.List<A>
): Sink<unknown, never, A, L.List<A>> {
  return new Pipe.NeedInput(
    (i) => sinkListGo((ls) => front(L.prepend_(ls, i))),
    () => new Pipe.Done(front(L.empty()))
  )
}

/**
 * Sink that consumes the Conduit to a List
 */
export function list<A>(): Sink<unknown, never, A, L.List<A>> {
  return sinkListGo(identity)
}

/**
 * Wait for a single input value from upstream. If no data is available,
 * returns `Nothing`. Once `await` returns `Nothing`, subsequent calls will
 * also return `Nothing`.
 */
function sinkAwait<A>(): Sink<unknown, never, A, O.Option<A>> {
  return new Pipe.NeedInput(
    (i) => new Pipe.Done(O.some(i)),
    () => new Pipe.Done(O.none)
  )
}

export { sinkAwait as await }
