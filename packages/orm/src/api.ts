import * as OR from "./orm";
import { effect as T } from "@matechs/effect";
import { ObjectType, DeepPartial, SaveOptions } from "typeorm";
import { pipe } from "fp-ts/lib/pipeable";

export type Target<O> = ObjectType<O>;

export const DatabaseURI = "@matechs/orm/DatabaseURI";

export interface Database<DbURI extends symbol | string> {
  [DatabaseURI]: {
    [k in DbURI]: {
      repository<O>(
        _: Target<O>
      ): {
        save<T extends DeepPartial<O>>(
          entity: T,
          options?: SaveOptions
        ): T.IO<OR.TaskError, O>;
      };
    };
  };
}

const repository_ = <DbURI extends symbol | string>(DbURI: DbURI) => <O>(
  Target: Target<O>
) => ({
  save: <T extends DeepPartial<O>>(entity: T, options?: SaveOptions) =>
    T.accessM((_: Database<DbURI>) =>
      _[DatabaseURI][DbURI].repository(Target).save(entity, options)
    ),
});

export const database = <DbURI extends symbol | string>(DbURI: DbURI) => {
  const repository = repository_(DbURI);
  const orm = OR.dbT(DbURI);

  const provide = <R, E, A>(
    eff: T.Effect<R & Database<DbURI>, E, A>
  ): T.Effect<R & OR.ORM<DbURI>, E, A> => {
    const provideDb = T.provideSW<Database<DbURI>>()(
      T.accessEnvironment<OR.ORM<DbURI>>()
    )((r) => ({
      [DatabaseURI]: {
        ...r[DatabaseURI],
        [DbURI]: {
          repository: (Target) => ({
            save: (entity, options) =>
              pipe(
                orm.withRepositoryTask(Target)((_) => () =>
                  _.save(entity, options)
                ),
                T.provideR((_: any) => ({ ...r, ..._ })) // inverted for local overwrite
              ),
          }),
        } as Database<DbURI>[typeof DatabaseURI][DbURI],
      } as Database<DbURI>[typeof DatabaseURI],
    }));

    return pipe(eff, provideDb);
  };

  return {
    repository,
    provide,
    orm,
  };
};
