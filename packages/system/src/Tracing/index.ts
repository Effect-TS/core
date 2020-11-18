import { ExecutionTrace } from "../Effect"
import { identity } from "../Function"
import { AtomicBoolean } from "../Support/AtomicBoolean"

export const reg = /\/(.*?):(\d+):(\d+)/

export const globalTracingEnabled = new AtomicBoolean(false)

export function traceWith(name: string) {
  if (globalTracingEnabled.get) {
    const line = new Error()?.stack?.split("\n")?.[5]

    if (line) {
      const ref = reg.exec(line)

      if (ref) {
        return <X>(x: X) => {
          if ("$trace" in x) {
            return x
          }
          x["$trace"] = new ExecutionTrace(`/${ref[1]}:${ref[2]}:${ref[3]}`, name)
          return x
        }
      }
    }
  }
  return identity
}

export function traceFrom<F>(f: F) {
  return <G>(g: G): G => {
    if (globalTracingEnabled.get && "$trace" in f) {
      g["$trace"] = f["$trace"]
    }
    return g
  }
}

export function traceF(f: () => <A>(a: A) => A): <A>(a: A) => A {
  if (globalTracingEnabled.get) {
    return f()
  }
  return identity
}
