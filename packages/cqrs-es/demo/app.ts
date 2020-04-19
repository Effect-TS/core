import { T, Service as F } from "@matechs/prelude";
import { logger } from "@matechs/logger";

export const appURI = Symbol();

export interface App {
  [appURI]: {
    printTodo: (todo: string) => T.Sync<void>;
  };
}

export const appSpec = F.define<App>({
  [appURI]: {
    printTodo: F.fn()
  }
});

export const { printTodo } = F.access(appSpec)[appURI];

export const provideApp = F.implement(appSpec)({
  [appURI]: {
    printTodo: todo => logger.info(`todo: ${JSON.stringify(todo)}`)
  }
});
