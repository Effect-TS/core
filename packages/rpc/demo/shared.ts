import { effect as T, freeEnv as F } from "@matechs/effect";
import { Option } from "fp-ts/lib/Option";

// environment entries
export const placeholderJsonEnv: unique symbol = Symbol();

// simple todo interface
export interface Todo {
  userId: number;
  id: number;
  title: string;
  completed: boolean;
}

export interface PlaceholderJson extends F.ModuleShape<PlaceholderJson> {
  [placeholderJsonEnv]: {
    getTodo: (n: number) => T.AsyncE<string, Option<Todo>>;
  };
}

export const placeholderJsonM = F.define<PlaceholderJson>({
  [placeholderJsonEnv]: {
    getTodo: F.fn()
  }
});