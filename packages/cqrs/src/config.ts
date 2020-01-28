import { effect as T, freeEnv as F } from "@matechs/effect";

// experimental alpha
/* istanbul ignore file */

export const readSideURI: unique symbol = Symbol();

export interface ReadSideConfig {
  id: string;
  limit: number;
  delay: number;
}

export interface ReadSideConfigService
  extends F.ModuleShape<ReadSideConfigService> {
  [readSideURI]: {
    accessConfig: T.UIO<ReadSideConfig>;
  };
}

export const readSideConfigSpec = F.define<ReadSideConfigService>({
  [readSideURI]: {
    accessConfig: F.cn()
  }
});

export const { accessConfig } = F.access(readSideConfigSpec)[readSideURI];

export const withConfig = (i: ReadSideConfig) =>
  F.implement(readSideConfigSpec)({
    [readSideURI]: {
      accessConfig: T.pure(i)
    }
  });
