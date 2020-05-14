import type { Identity } from "./Identity"
/**
 * @since 2.0.0
 */

export const URI = "Identity"
/**
 * @since 2.0.0
 */

export type URI = typeof URI

declare module "fp-ts/lib/HKT" {
  interface URItoKind<A> {
    readonly Identity: Identity<A>
  }
}
