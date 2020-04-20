import {} from "@morphic-ts/batteries/lib/summoner-ESBAST";
import {} from "@morphic-ts/batteries/lib/program";
import {} from "@morphic-ts/batteries/lib/program-orderable";

import { T, M, pipe, O, NEA } from "@matechs/prelude";
import { Aggregate, ReadSideConfig, EventMetaHidden } from "@matechs/cqrs";
import { sendEvent, eventStoreTcpConnection } from "./client";
import { readEvents } from "./read";
import { ProgramURI } from "@morphic-ts/batteries/lib/usage/ProgramType";
import { InterpreterURI } from "@morphic-ts/batteries/lib/usage/InterpreterResult";
import { AOfTypes } from "@morphic-ts/batteries/lib/usage/tagged-union";
import { ElemType } from "@morphic-ts/adt/lib/utils";
import { ormOffsetStore } from "./offset";
import { adaptMeta } from "./meta";

const aggregateRead = <
  Types extends {
    [k in keyof Types]: [any, any];
  },
  Tag extends string,
  ProgURI extends ProgramURI,
  InterpURI extends InterpreterURI,
  Keys extends NEA.NonEmptyArray<keyof Types>,
  Db extends symbol | string
>(
  agg: Aggregate<Types, Tag, ProgURI, InterpURI, Keys, Db>
) => (config: ReadSideConfig) =>
  M.use(eventStoreTcpConnection, (connection) =>
    agg.readAll(config)((_) => T.traverseArray(sendEvent(connection)))
  );

export const aggregate = <
  Types extends {
    [k in keyof Types]: [any, any];
  },
  Tag extends string,
  ProgURI extends ProgramURI,
  InterpURI extends InterpreterURI,
  Keys extends NEA.NonEmptyArray<keyof Types>,
  Db extends symbol | string
>(
  agg: Aggregate<Types, Tag, ProgURI, InterpURI, Keys, Db>
) => ({
  dispatcher: aggregateRead(agg),
  read: (readId: string) => <S2, R2, E2>(
    process: (
      a: AOfTypes<{ [k in Extract<keyof Types, ElemType<Keys>>]: Types[k] }> & EventMetaHidden
    ) => T.Effect<S2, R2, E2, void>
  ) =>
    readEvents(readId)(`$ce-${agg.aggregate}`)(T.liftEither((x) => agg.adt.type.decode(x)))((a) =>
      pipe(adaptMeta(a), (meta) =>
        O.isSome(meta)
          ? process({ ...a, ...meta.value })
          : T.raiseAbort(new Error("cannot decode metadata"))
      )
    )(ormOffsetStore(agg.db))((x) => agg.db.withORMTransaction(x))
});

export { EventStoreError, EventStoreConfig, eventStoreURI } from "./client";
export { offsetStore, OffsetStore, readEvents } from "./read";
export { TableOffset, ormOffsetStore } from "./offset";
