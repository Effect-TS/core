import { chain_ } from "../Effect/chain_"
import { Effect, Sync } from "../Effect/effect"
import { effectTotal } from "../Effect/effectTotal"
import { accessServiceM, hasClass, replaceService_ } from "../Has"

import { PRNG } from "./Alea"

export const RandomURI = "@matechs/core/Eff/RandomURI"

export interface Random {
  [RandomURI]: {
    prng: PRNG
  }
}

export abstract class Random {
  abstract readonly next: Sync<number>
  abstract readonly nextBoolean: Sync<boolean>
  abstract readonly nextInt: Sync<number>
  abstract readonly nextDouble: Sync<number>
  abstract readonly nextRange: (low: number, high: number) => Sync<number>
  abstract readonly nextIntBetween: (low: number, high: number) => Sync<number>
  abstract readonly setSeed: (s: string) => Sync<void>
}

export class LiveRandom extends Random {
  private PRNG = new PRNG(this.seed)

  constructor(private seed: string) {
    super()
  }

  next: Sync<number> = effectTotal(() => this.PRNG.next())

  nextBoolean: Sync<boolean> = chain_(this.next, (n) => effectTotal(() => n > 0.5))

  nextInt: Sync<number> = effectTotal(() => this.PRNG.int32())

  nextDouble: Sync<number> = effectTotal(() => this.PRNG.double())

  nextRange: (low: number, high: number) => Sync<number> = (low, high) =>
    chain_(this.next, (n) => effectTotal(() => (high - low) * n + low))

  nextIntBetween: (low: number, high: number) => Sync<number> = (low, high) =>
    chain_(this.next, (n) => effectTotal(() => Math.floor((high - low + 1) * n + low)))

  setSeed = (s: string) =>
    effectTotal(() => {
      this.PRNG.setSeed(s)
    })
}

export const defaultRandom =
  /*#__PURE__*/
  new LiveRandom(String(Math.random()))

export const HasRandom = hasClass(Random)
export type HasRandom = typeof HasRandom

export const next =
  /*#__PURE__*/
  accessServiceM(HasRandom)((_) => _.next)

export const nextBoolean =
  /*#__PURE__*/
  accessServiceM(HasRandom)((_) => _.nextBoolean)

export const nextIntBetween = (low: number, high: number) =>
  accessServiceM(HasRandom)((_) => _.nextIntBetween(low, high))

export const nextInt =
  /*#__PURE__*/
  accessServiceM(HasRandom)((_) => _.nextInt)

export const nextDouble =
  /*#__PURE__*/
  accessServiceM(HasRandom)((_) => _.nextDouble)

export const nextRange = (low: number, high: number) =>
  accessServiceM(HasRandom)((_) => _.nextRange(low, high))

export const setSeed = (seed: string) =>
  accessServiceM(HasRandom)((_) => _.setSeed(seed))

export const withSeed = (seed: string) => <S, R, E, A>(
  effect: Effect<S, R & HasRandom, E, A>
) => replaceService_(effect, HasRandom, () => new LiveRandom(seed))
