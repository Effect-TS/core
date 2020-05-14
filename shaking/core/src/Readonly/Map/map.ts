import { map_ } from "./map_"

export const map: <A, B>(
  f: (a: A) => B
) => <E>(fa: ReadonlyMap<E, A>) => ReadonlyMap<E, B> = (f) => (fa) => map_(fa, f)
