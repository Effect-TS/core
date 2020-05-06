import { T, Service as F } from "@matechs/prelude"
import { Do } from "fp-ts-contrib/lib/Do"

import * as L from "./logger"

function format(level: L.Level, message: string, meta?: L.Meta) {
  return `${level}: ${message}${meta ? `(${JSON.stringify({ meta })})` : ""}`
}

function log(
  config: Config,
  level: L.Level,
  message: string,
  meta?: L.Meta
): T.Sync<void> {
  return (
    Do(T.effect)
      .let("config", config)
      .bindL("formatter", (s) => T.pure(s.config.formatter ?? format))
      .bindL("level", (s) => T.pure(s.config.level ?? "silly"))
      .bindL("msg", (s) => T.pure(s.formatter(level, message, meta)))
      .doL(({ level: configLevel, msg }) =>
        T.when(L.severity[configLevel] >= L.severity[level])(
          T.sync(() => {
            switch (level) {
              case "info":
                // tslint:disable-next-line: no-console
                console.info(msg)
                break
              case "debug":
                // tslint:disable-next-line: no-console
                console.debug(msg)
                break
              case "error":
                // tslint:disable-next-line: no-console
                console.error(msg)
                break
              case "http":
                // tslint:disable-next-line: no-console
                console.info(msg)
                break
              case "silly":
                // tslint:disable-next-line: no-console
                console.debug(msg)
                break
              case "verbose":
                // tslint:disable-next-line: no-console
                console.debug(msg)
                break
              case "warn":
                // tslint:disable-next-line: no-console
                console.warn(msg)
                break
            }
          })
        )
      )
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      .return(() => {})
  )
}

export interface Config {
  formatter?: typeof format
  level?: L.Level
}

export const ConsoleLoggerConfigURI = "@matechs/logger/console/ConsoleLoggerConfigURI"
export interface ConsoleLoggerConfig {
  [ConsoleLoggerConfigURI]: Config
}

export const provideConsoleLoggerConfig = (config: Config = {}) =>
  T.provide<ConsoleLoggerConfig>({
    [ConsoleLoggerConfigURI]: config
  })

export const provideConsoleLogger = F.implementWith(
  T.access((_: ConsoleLoggerConfig) => _[ConsoleLoggerConfigURI])
)(L.Logger)((config) => ({
  [L.LoggerURI]: {
    debug: (message, meta) => log(config, "debug", message, meta),
    http: (message, meta) => log(config, "http", message, meta),
    silly: (message, meta) => log(config, "silly", message, meta),
    error: (message, meta) => log(config, "error", message, meta),
    info: (message, meta) => log(config, "info", message, meta),
    verbose: (message, meta) => log(config, "verbose", message, meta),
    warn: (message, meta) => log(config, "warn", message, meta)
  }
}))
