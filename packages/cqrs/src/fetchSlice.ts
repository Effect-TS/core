import { effect as T } from "@matechs/effect";
import { DbT } from "@matechs/orm";
import { sequenceS } from "fp-ts/lib/Apply";
import { array } from "fp-ts/lib/Array";
import { pipe } from "fp-ts/lib/pipeable";
import { accessConfig } from "./config";
import { TypeADT } from "./domain";
import { NonEmptyArray } from "fp-ts/lib/NonEmptyArray";
import { ElemType } from "morphic-ts/lib/adt/utils";

// experimental alpha
/* istanbul ignore file */

export class SliceFetcher<
  E,
  A extends { [t in Tag]: A[Tag] },
  Tag extends keyof A & string,
  Keys extends NonEmptyArray<A[Tag]>,
  Db extends symbol
> {
  private readonly isNarrowed: (
    a: A
  ) => a is Extract<A, Record<Tag, ElemType<Keys>>>;

  constructor(
    private readonly S: TypeADT<E, A, Tag>,
    private readonly eventTypes: Keys,
    private readonly db: DbT<Db>
  ) {
    const nS = S.select(eventTypes);

    this.isNarrowed = (a): a is Extract<A, Record<Tag, ElemType<Keys>>> =>
      nS.keys[a[S.tag]] ? true : false;
  }

  fetchSlice(aggregate: string) {
    return pipe(
      accessConfig,
      T.chain(({ id, limit }) =>
        pipe(
          pipe(
            T.pure(
              `SELECT id, event FROM event_log WHERE aggregate = '${aggregate}' AND kind IN(${this.eventTypes
                .map(e => `'${e}'`)
                .join(
                  ","
                )}) AND offsets->>'${id}' IS NULL ORDER BY sequence ASC LIMIT ${limit};`
            ),
            T.chain(query =>
              this.db.withManagerTask(manager => () => manager.query(query))
            )
          )
        )
      ),
      T.map((x: Array<{ id: string; event: unknown }>) => x.map(e => e)),
      T.chain(events =>
        array.traverse(T.effect)(events, ({ id, event }) =>
          sequenceS(T.effect)({
            id: T.pure(id),
            event: T.orAbort(
              pipe(
                T.fromEither(this.S.type.decode(event)),
                T.chain(a =>
                  this.isNarrowed(a)
                    ? T.pure(a)
                    : T.raiseError(new Error("decoded event is out of bounds"))
                )
              )
            )
          })
        )
      )
    );
  }
}

export class AggregateFetcher<
  E,
  A extends { [t in Tag]: A[Tag] },
  Tag extends keyof A & string,
  Keys extends NonEmptyArray<A[Tag]>,
  Db extends symbol
> {
  private readonly isNarrowed: (
    a: A
  ) => a is Extract<A, Record<Tag, ElemType<Keys>>>;

  constructor(
    private readonly S: TypeADT<E, A, Tag>,
    eventTypes: Keys,
    private readonly db: DbT<Db>
  ) {
    const nS = S.select(eventTypes);

    this.isNarrowed = (a): a is Extract<A, Record<Tag, ElemType<Keys>>> =>
      nS.keys[a[S.tag]] ? true : false;
  }

  fetchSlice(aggregate: string) {
    return pipe(
      accessConfig,
      T.chain(({ id, limit }) =>
        pipe(
          pipe(
            T.pure(
              `SELECT id, event FROM event_log WHERE aggregate = '${aggregate}' AND offsets->>'${id}' IS NULL ORDER BY sequence ASC LIMIT ${limit};`
            ),
            T.chain(query =>
              this.db.withManagerTask(manager => () => manager.query(query))
            )
          )
        )
      ),
      T.map((x: Array<{ id: string; event: unknown }>) => x.map(e => e)),
      T.chain(events =>
        array.traverse(T.effect)(events, ({ id, event }) =>
          sequenceS(T.effect)({
            id: T.pure(id),
            event: T.orAbort(
              pipe(
                T.fromEither(this.S.type.decode(event)),
                T.chain(a =>
                  this.isNarrowed(a)
                    ? T.pure(a)
                    : T.raiseError(new Error("decoded event is out of bounds"))
                )
              )
            )
          })
        )
      )
    );
  }
}

export class DomainFetcher<
  E,
  A extends { [t in Tag]: A[Tag] },
  Tag extends keyof A & string,
  Keys extends NonEmptyArray<A[Tag]>,
  Db extends symbol
> {
  private readonly isNarrowed: (
    a: A
  ) => a is Extract<A, Record<Tag, ElemType<Keys>>>;

  constructor(
    private readonly S: TypeADT<E, A, Tag>,
    private readonly eventTypes: Keys,
    private readonly db: DbT<Db>
  ) {
    const nS = S.select(eventTypes);

    this.isNarrowed = (a): a is Extract<A, Record<Tag, ElemType<Keys>>> =>
      nS.keys[a[S.tag]] ? true : false;
  }

  fetchSlice() {
    return pipe(
      accessConfig,
      T.chain(({ id, limit }) =>
        pipe(
          pipe(
            T.pure(
              `SELECT id, event FROM event_log WHERE kind IN(${this.eventTypes
                .map(e => `'${e}'`)
                .join(
                  ","
                )}) AND offsets->>'${id}' IS NULL ORDER BY sequence ASC LIMIT ${limit};`
            ),
            T.chain(query =>
              this.db.withManagerTask(manager => () => manager.query(query))
            )
          )
        )
      ),
      T.map((x: Array<{ id: string; event: unknown }>) => x.map(e => e)),
      T.chain(events =>
        array.traverse(T.effect)(events, ({ id, event }) =>
          sequenceS(T.effect)({
            id: T.pure(id),
            event: T.orAbort(
              pipe(
                T.fromEither(this.S.type.decode(event)),
                T.chain(a =>
                  this.isNarrowed(a)
                    ? T.pure(a)
                    : T.raiseError(new Error("decoded event is out of bounds"))
                )
              )
            )
          })
        )
      )
    );
  }
}

export class DomainFetcherAll<
  E,
  A,
  Tag extends keyof A & string,
  Db extends symbol
> {
  constructor(
    private readonly S: TypeADT<E, A, Tag>,
    private readonly db: DbT<Db>
  ) {}

  fetchSlice() {
    return pipe(
      accessConfig,
      T.chain(({ id, limit }) =>
        pipe(
          T.pure(
            `SELECT id, event FROM event_log WHERE offsets->>'${id}' IS NULL ORDER BY sequence ASC LIMIT ${limit};`
          ),
          T.chain(query =>
            this.db.withManagerTask(manager => () => manager.query(query))
          )
        )
      ),
      T.map((x: Array<{ id: string; event: unknown }>) => x.map(e => e)),
      T.chain(events =>
        array.traverse(T.effect)(events, ({ id, event }) =>
          sequenceS(T.effect)({
            id: T.pure(id),
            event: T.orAbort(T.fromEither(this.S.type.decode(event)))
          })
        )
      )
    );
  }
}
