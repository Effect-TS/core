import { makeAssociativeBoth } from "../_abstract/AssociativeBoth"
import * as L from "../_system/Layer"

export const LayerURI = "Layer"
export type LayerURI = typeof LayerURI

declare module "../_abstract/HKT" {
  interface URItoKind<
    TL0,
    TL1,
    TL2,
    TL3,
    K,
    NK extends string,
    SI,
    SO,
    X,
    I,
    S,
    Env,
    Err,
    Out
  > {
    [LayerURI]: L.Layer<X, Env, Err, Out>
  }
}

export const AssociativeBoth = makeAssociativeBoth<LayerURI>()()({
  both: (fb) => (fa) => L.zip_(fa, fb)
})
