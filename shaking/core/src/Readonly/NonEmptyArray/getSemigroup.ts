import { Semigroup } from "../../Semigroup"

import { ReadonlyNonEmptyArray } from "./ReadonlyNonEmptyArray"
import { concat } from "./concat"

/**
 * Builds a `Semigroup` instance for `ReadonlyNonEmptyArray`
 *
 * @since 2.5.0
 */
export function getSemigroup<A = never>(): Semigroup<ReadonlyNonEmptyArray<A>> {
  return {
    concat
  }
}
