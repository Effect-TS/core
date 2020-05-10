import { none } from "./none"

export const URI: "Option" = "Option"
export type URI = "Option"

export const defaultSeparate = { left: none, right: none }
export const identity = <A>(a: A): A => a
