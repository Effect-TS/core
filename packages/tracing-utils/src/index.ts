import { isTracingEnabled } from "./Global"

export function traceAs<F extends Function>(g: any, f: F): F {
  if (g["$trace"] && isTracingEnabled()) {
    f["$trace"] = g["$trace"]
  }
  return f
}

export function traceCall<F extends Function>(call: F, trace: string): F {
  if (!isTracingEnabled()) {
    return call
  }
  return ((...args: any[]) => {
    const y = call["$trace"]
    call["$trace"] = trace
    const x = call(...args)
    call["$trace"] = y
    return x
  }) as any
}

export * from "./Global"
