import { URI as EffectURI } from "./effect";
import { URI as EffectSyncURI } from "./effectSync";
import { URI as ManagedURI } from "./managed";
import { URI as StreamURI } from "./stream";
import { URI as StreamEitherURI } from "./streameither";

export type MatechsURIS = EffectURI | ManagedURI | StreamURI | StreamEitherURI | EffectSyncURI;
