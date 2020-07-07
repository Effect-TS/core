import * as C from "../../src/Eff/Cause"
import * as T from "../../src/Eff/Effect"
import * as E from "../../src/Eff/Exit"
import { pipe } from "../../src/Function"

describe("Core Implementation", () => {
  it("should interrupt async", async () => {
    const fn = jest.fn()

    const effect = T.effectAsyncInterrupt((cb: T.Cb<T.Async<number>>) => {
      const timer = setTimeout(() => {
        cb(T.succeedNow(1))
      }, 5000)
      return T.effectTotal(() => {
        clearTimeout(timer)
        fn()
      })
    })

    const cancel = T.runAsyncCancel(effect)

    const status = await T.runPromise(cancel)

    expect(E.interrupted(status) && C.interruptors(status.cause).size).toStrictEqual(1)
  })

  it("foreachParN_", async () => {
    let k = 0

    const res = await T.runPromise(
      T.foreachParN_(3)([0, 1, 2, 3, 4, 5], (n) =>
        T.effectAsync<unknown, never, number>((cb) => {
          k += 1
          setTimeout(() => {
            if (k <= 3) {
              k -= 1
            }
            cb(T.succeedNow(n + 1))
          }, 100)
        })
      )
    )

    expect(k).toBe(0)
    expect(res).toStrictEqual([1, 2, 3, 4, 5, 6])
  })

  it("provideAll", async () => {
    const res = await pipe(
      T.accessM((n: number) => T.succeedNow(n + 1)),
      T.provideAll(1),
      T.runPromise
    )

    expect(res).toStrictEqual(2)
  })
})
