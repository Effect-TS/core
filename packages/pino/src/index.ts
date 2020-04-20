import { effect as T, freeEnv as F } from "@matechs/effect";
import { logger as L } from "@matechs/logger";
import P from "pino";

// region Pino instance
export const PinoInstanceURI = "@matechs/pino/instanceURI";

export interface PinoInstanceEnv {
  [PinoInstanceURI]: {
    logger: T.Sync<P.Logger>;
  };
}

export const pinoInstanceM = F.define<PinoInstanceEnv>({
  [PinoInstanceURI]: { logger: F.cn() }
});

export const {
  [PinoInstanceURI]: { logger }
} = F.access(pinoInstanceM);
// endregion

// region Pino ops
export const PinoLoggerURI = "@matechs/pino/loggerURI";

export interface LogFn {
  (obj: object, msg?: string, ...args: unknown[]): T.Sync<void>;
  (msg: string, ...args: unknown[]): T.Sync<void>;
}

const withLogger = (f: (_: P.Logger) => T.Sync<void>) => T.effect.chain(logger, f);

export function fatal(
  obj: object,
  msg?: string,
  ...args: unknown[]
): T.SyncR<PinoInstanceEnv, void>;
export function fatal(msg: string, ...args: unknown[]): T.SyncR<PinoInstanceEnv, void>;
export function fatal(...args: [any, ...unknown[]]): T.SyncR<PinoInstanceEnv, void> {
  return withLogger((l) => T.sync(() => l.fatal(...args)));
}

export function error(
  obj: object,
  msg?: string,
  ...args: unknown[]
): T.SyncR<PinoInstanceEnv, void>;
export function error(msg: string, ...args: unknown[]): T.SyncR<PinoInstanceEnv, void>;
export function error(...args: [any, ...unknown[]]): T.SyncR<PinoInstanceEnv, void> {
  return withLogger((l) => T.sync(() => l.error(...args)));
}

export function warn(obj: object, msg?: string, ...args: unknown[]): T.SyncR<PinoInstanceEnv, void>;
export function warn(msg: string, ...args: unknown[]): T.SyncR<PinoInstanceEnv, void>;
export function warn(...args: [any, ...unknown[]]): T.SyncR<PinoInstanceEnv, void> {
  return withLogger((l) => T.sync(() => l.warn(...args)));
}

export function info(obj: object, msg?: string, ...args: unknown[]): T.SyncR<PinoInstanceEnv, void>;
export function info(msg: string, ...args: unknown[]): T.SyncR<PinoInstanceEnv, void>;
export function info(...args: [any, ...unknown[]]): T.SyncR<PinoInstanceEnv, void> {
  return withLogger((l) => T.sync(() => l.info(...args)));
}

export function debug(
  obj: object,
  msg?: string,
  ...args: unknown[]
): T.SyncR<PinoInstanceEnv, void>;
export function debug(msg: string, ...args: unknown[]): T.SyncR<PinoInstanceEnv, void>;
export function debug(...args: [any, ...unknown[]]): T.SyncR<PinoInstanceEnv, void> {
  return withLogger((l) => T.sync(() => l.debug(...args)));
}

export function trace(
  obj: object,
  msg?: string,
  ...args: unknown[]
): T.SyncR<PinoInstanceEnv, void>;
export function trace(msg: string, ...args: unknown[]): T.SyncR<PinoInstanceEnv, void>;
export function trace(...args: [any, ...unknown[]]): T.SyncR<PinoInstanceEnv, void> {
  return withLogger((l) => T.sync(() => l.trace(...args)));
}

// endregion

// region instances
export function providePino(opts?: {}): T.Provider<unknown, PinoInstanceEnv>;
export function providePino(
  opts: P.LoggerOptions,
  stream?: P.DestinationStream
): T.Provider<unknown, PinoInstanceEnv>;
export function providePino(opts: P.LoggerOptions = {}, stream?: P.DestinationStream) {
  return F.implementWith(T.sync(() => P(...[opts, stream])))(pinoInstanceM)((logger) => ({
    [PinoInstanceURI]: { logger: T.pure(logger) }
  }));
}

export const providePinoLogger = F.implementWith(logger)(L.Logger)((l) => ({
  [L.LoggerURI]: {
    error: (message, meta = {}) => T.sync(() => l.error(meta, message)),
    warn: (message, meta = {}) => T.sync(() => l.warn(meta, message)),
    info: (message, meta = {}) => T.sync(() => l.info(meta, message)),
    http: (message, meta = {}) => T.sync(() => l.info(meta, message)),
    verbose: (message, meta = {}) => T.sync(() => l.info(meta, message)),
    debug: (message, meta = {}) => T.sync(() => l.debug(meta, message)),
    silly: (message, meta = {}) => T.sync(() => l.trace(meta, message))
  }
}));
// endregion
