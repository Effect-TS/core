import type { Compact } from "../Compact"
import type { Auto, URIS } from "../HKT"
import type { Separate } from "../Separate"

export type Compactable<F extends URIS, C = Auto> = Compact<F, C> & Separate<F, C>
