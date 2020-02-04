import * as React from "react";
import { effect as T, freeEnv as F } from "@matechs/effect";
import * as R from "../../lib";
import { Do } from "fp-ts-contrib/lib/Do";
import { pipe } from "fp-ts/lib/pipeable";
import { summon } from "morphic-ts/lib/batteries/summoner-no-union";
import { AType } from "morphic-ts/lib/usage/utils";
import { isDone } from "@matechs/effect/lib/exit";
import * as O from "fp-ts/lib/Option";
import { flow } from "fp-ts/lib/function";

// alpha
/* istanbul ignore file */

const AppState = summon(F =>
  F.interface(
    {
      date: F.date(),
      orgs: F.nullable(F.array(F.unknown())),
      error: F.nullable(F.string())
    },
    "AppState"
  )
);

type AppState = AType<typeof AppState>;

const initialState = (): AppState =>
  AppState.build({
    date: new Date(),
    orgs: O.none,
    error: O.none
  });

const dateOpsURI = Symbol();

interface DateOps extends F.ModuleShape<DateOps> {
  [dateOpsURI]: {
    updateDate: T.UIO<void>;
  };
}

const dateOpsSpec = F.define<DateOps>({
  [dateOpsURI]: {
    updateDate: F.cn()
  }
});

const dateL = AppState.lenseFromProp("date");
const errorL = AppState.lenseFromProp("error");
const orgsL = AppState.lenseFromProp("orgs");

const dateOps = F.implement(dateOpsSpec)({
  [dateOpsURI]: {
    updateDate: T.asUnit(R.updateS(dateL.modify(() => new Date())))
  }
});

const { updateDate } = F.access(dateOpsSpec)[dateOpsURI];

const APP = R.app<DateOps>()(initialState, AppState.type);

const updateDateButton = Do(T.effect)
  .sequenceS({
    dispatcher: APP.dispatcher
  })
  .return(
    ({ dispatcher }): React.FC => () => (
      <button
        onClick={() => {
          dispatcher(updateDate);
        }}
      >
        Update Date!
      </button>
    )
  );

const fetchJSON = pipe(
  T.result(
    T.fromPromise(() =>
      fetch("https://api.github.com/users/hadley/orgs").then(r => r.json())
    )
  ),
  T.chain(res =>
    isDone(res)
      ? R.updateS(flow(orgsL.set(O.some(res.value)), errorL.set(O.none)))
      : R.updateS(errorL.set(O.some("error while fetching")))
  )
);

const fetchButton = Do(T.effect)
  .sequenceS({
    dispatcher: APP.dispatcher
  })
  .return(
    ({ dispatcher }): React.FC => () => (
      <button
        onClick={() => {
          dispatcher(fetchJSON);
        }}
      >
        Fetch!
      </button>
    )
  );

const DateComponent = (_: { date: Date }) => <div>{_.date.toISOString()}</div>;

const MemoInput = React.memo(() => <input type={"text"} />);

const home = Do(T.effect)
  .sequenceS({
    Button: updateDateButton,
    Fetch: fetchButton
  })
  .return(
    ({ Button, Fetch }): React.FC<R.StateP<AppState>> => ({ state }) => (
      <>
        <DateComponent date={pipe(state, dateL.get)} />
        <Button />
        <Fetch />
        {pipe(
          state,
          orgsL.get,
          O.map(orgs => <div>Orgs loaded: {orgs.length}</div>),
          O.toNullable
        )}
        {pipe(
          state,
          errorL.get,
          O.map(error => <div>{error}</div>),
          O.toNullable
        )}
        <MemoInput />
      </>
    )
  );

// tslint:disable-next-line: no-default-export
export default APP.page(pipe(home, dateOps));
