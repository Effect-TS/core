import * as T from "../src/Effect"
import * as E from "../src/Either"
import * as Exit from "../src/Exit"
import { absurd, pipe, tuple } from "../src/Function"

describe("Effect", () => {
  it("absolve", () => {
    const program = T.absolve(T.succeed(E.left("e")))

    expect(T.runSyncExit(program)).toEqual(Exit.fail("e"))
  })
  it("absorbWith", () => {
    const program = pipe(T.die("e"), T.absorbWith(absurd))
    const program2 = pipe(
      T.fail("e"),
      T.absorbWith((e) => `${e}-ok`)
    )

    expect(T.runSyncExit(program)).toEqual(Exit.fail("e"))
    expect(T.runSyncExit(program2)).toEqual(Exit.fail("e-ok"))
  })
  it("tupled", () => {
    const program = T.tupled(T.succeed(0), T.succeed("ok"), T.fail("e"))
    expect(T.runSyncExit(program)).toEqual(Exit.fail("e"))
  })
  it("mapN", () => {
    const program = pipe(
      tuple(T.succeed(0), T.fail("e"), T.succeed("ok")),
      T.mapN(([a, _, c]) => a + c.length)
    )
    expect(T.runSyncExit(program)).toEqual(Exit.fail("e"))
  })
  it("memoize", async () => {
    const m = jest.fn()
    const result = await pipe(
      T.memoize((n: number) =>
        T.effectTotal(() => {
          m(n)
          return n + 1
        })
      ),
      T.chain((f) =>
        T.struct({
          a: f(0),
          b: f(0),
          c: f(1),
          d: f(1)
        })
      ),
      T.runPromiseExit
    )

    expect(result).toEqual(Exit.succeed({ a: 1, b: 1, c: 2, d: 2 }))
    expect(m).toHaveBeenNthCalledWith(1, 0)
    expect(m).toHaveBeenNthCalledWith(2, 1)
    expect(m).toHaveBeenCalledTimes(2)
  })
  it("raceAll - wait", async () => {
    const a = jest.fn()
    const b = jest.fn()
    const c = jest.fn()

    const program = T.raceAll(
      [
        T.effectAsyncInterrupt<unknown, never, number>((cb) => {
          const t = setTimeout(() => {
            cb(T.succeed(1))
          }, 5000)
          return T.effectTotal(() => {
            a()
            clearTimeout(t)
          })
        }),
        T.effectAsyncInterrupt<unknown, never, number>((cb) => {
          const t = setTimeout(() => {
            cb(T.succeed(2))
          }, 100)
          return T.effectTotal(() => {
            b()
            clearTimeout(t)
          })
        }),
        T.effectAsyncInterrupt<unknown, never, number>((cb) => {
          const t = setTimeout(() => {
            cb(T.succeed(3))
          }, 5000)
          return T.effectTotal(() => {
            c()
            clearTimeout(t)
          })
        })
      ],
      "wait"
    )

    const result = await T.runPromiseExit(program)

    expect(result).toEqual(Exit.succeed(2))

    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(0)
    expect(c).toHaveBeenCalledTimes(1)
  })
  it("raceAll", async () => {
    const a = jest.fn()
    const b = jest.fn()
    const c = jest.fn()

    const program = T.raceAll([
      T.effectAsyncInterrupt<unknown, never, number>((cb) => {
        const t = setTimeout(() => {
          cb(T.succeed(1))
        }, 5000)
        return T.effectTotal(() => {
          a()
          clearTimeout(t)
        })
      }),
      T.effectAsyncInterrupt<unknown, never, number>((cb) => {
        const t = setTimeout(() => {
          cb(T.succeed(2))
        }, 100)
        return T.effectTotal(() => {
          b()
          clearTimeout(t)
        })
      }),
      T.effectAsyncInterrupt<unknown, never, number>((cb) => {
        const t = setTimeout(() => {
          cb(T.succeed(3))
        }, 5000)
        return T.effectTotal(() => {
          c()
          clearTimeout(t)
        })
      })
    ])

    const result = await T.runPromiseExit(program)

    expect(result).toEqual(Exit.succeed(2))

    expect(a).toHaveBeenCalledTimes(0)
    expect(b).toHaveBeenCalledTimes(0)
    expect(c).toHaveBeenCalledTimes(0)

    await T.runPromise(T.sleep(100))

    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(0)
    expect(c).toHaveBeenCalledTimes(1)
  })
})
