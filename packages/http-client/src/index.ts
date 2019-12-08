import { effect as T } from "@matechs/effect";
import { ParsedUrlQueryInput } from "querystring";
import { Predicate } from "fp-ts/lib/function";

/* tested in the implementation packages */
/* istanbul ignore file */

export const ENV_URIS = {
  MiddlewareStack: "@matechs/http/middlewareStack" as const,
  Http: "@matechs/http/mainModule" as const,
  HttpHeaders: "@matechs/http/headers" as const,
  HttpDeserializer: "@matechs/http/deserializer" as const
};

export enum Method {
  GET,
  POST,
  PUT,
  DELETE,
  PATCH
}

export enum RequestType {
  JSON,
  DATA
}

export type Headers = Record<string, string>;

export interface Response<Body> {
  body?: Body;
  headers: Headers;
  status: number;
}

export interface HttpResponseError<ErrorBody> {
  _tag: HttpErrorReason.Response;
  response: Response<ErrorBody>;
}

export interface HttpRequestError {
  _tag: HttpErrorReason.Request;
  error: Error;
}

export interface HttpDeserializer {
  [ENV_URIS.HttpDeserializer]: {
    response: <A>(a: string) => A | undefined;
    errorResponse: <E>(error: string) => E | undefined;
  };
}

export enum HttpErrorReason {
  Request,
  Response
}

export type HttpError<ErrorBody> =
  | HttpRequestError
  | HttpResponseError<ErrorBody>;

export function foldHttpError<A, B, ErrorBody>(
  onError: (e: Error) => A,
  onResponseError: (e: Response<ErrorBody>) => B
): (err: HttpError<ErrorBody>) => A | B {
  return err => {
    switch (err._tag) {
      case HttpErrorReason.Request:
        return onError(err.error);
      case HttpErrorReason.Response:
        return onResponseError(err.response);
    }
  };
}

export interface HttpHeaders {
  [ENV_URIS.HttpHeaders]: Record<string, string>;
}

export interface Http {
  [ENV_URIS.Http]: {
    request: <I, E, O>(
      method: Method,
      url: string,
      headers: Record<string, string>,
      body?: I,
      requestType?: RequestType
    ) => T.Effect<HttpDeserializer, HttpError<E>, Response<O>>;
  };
}

function hasHeaders(r: unknown): r is HttpHeaders {
  return typeof r === "object" && !!r && ENV_URIS.HttpHeaders in r;
}

type RequestF = <R, I, E, O>(
  method: Method,
  url: string,
  body?: I,
  requestType?: RequestType
) => T.Effect<RequestEnv & R, HttpError<E>, Response<O>>;

export type RequestMiddleware = (request: RequestF) => RequestF;

export interface MiddlewareStack {
  [ENV_URIS.MiddlewareStack]: {
    stack: RequestMiddleware[];
  };
}

export const middlewareStack: (
  stack?: MiddlewareStack[typeof ENV_URIS.MiddlewareStack]["stack"]
) => MiddlewareStack = (stack = []) => ({
  [ENV_URIS.MiddlewareStack]: {
    stack
  }
});

export type RequestEnv = Http & HttpDeserializer & MiddlewareStack;

function foldMiddlewareStack(
  { [ENV_URIS.MiddlewareStack]: { stack } }: MiddlewareStack,
  request: RequestF
): RequestF {
  if (stack.length > 0) {
    let r = request;

    for (const middleware of stack) {
      r = middleware(r);
    }

    return r;
  }

  return request;
}

export function requestInner<R, I, E, O>(
  method: Method,
  url: string,
  body?: I,
  requestType?: RequestType
): T.Effect<RequestEnv & R, HttpError<E>, Response<O>> {
  return T.accessM((r: Http & R) => {
    if (hasHeaders(r)) {
      return r[ENV_URIS.Http].request(
        method,
        url,
        r[ENV_URIS.HttpHeaders],
        body,
        requestType
      );
    } else {
      return r[ENV_URIS.Http].request(method, url, {}, body, requestType);
    }
  });
}

export function request<R, I, E, O>(
  method: Method,
  url: string,
  body?: I,
  requestType?: RequestType
): T.Effect<RequestEnv & R, HttpError<E>, Response<O>> {
  return T.accessM((r: MiddlewareStack) =>
    foldMiddlewareStack(r, requestInner)<R, I, E, O>(
      method,
      url,
      body,
      requestType
    )
  );
}

export function get<E, O>(
  url: string
): T.Effect<RequestEnv, HttpError<E>, Response<O>> {
  return request(Method.GET, url);
}

export function post<I, E, O>(
  url: string,
  body?: I
): T.Effect<RequestEnv, HttpError<E>, Response<O>> {
  return request(Method.POST, url, body);
}

export function postData<I extends ParsedUrlQueryInput, E, O>(
  url: string,
  body?: I
): T.Effect<RequestEnv, HttpError<E>, Response<O>> {
  return request(Method.POST, url, body, RequestType.DATA);
}

export function patch<I, E, O>(
  url: string,
  body?: I
): T.Effect<RequestEnv, HttpError<E>, Response<O>> {
  return request(Method.PATCH, url, body);
}

export function patchData<I extends ParsedUrlQueryInput, E, O>(
  url: string,
  body?: I
): T.Effect<RequestEnv, HttpError<E>, Response<O>> {
  return request(Method.PATCH, url, body, RequestType.DATA);
}

export function put<I, E, O>(
  url: string,
  body?: I
): T.Effect<RequestEnv, HttpError<E>, Response<O>> {
  return request(Method.PUT, url, body);
}

export function putData<I extends ParsedUrlQueryInput, E, O>(
  url: string,
  body?: I
): T.Effect<RequestEnv, HttpError<E>, Response<O>> {
  return request(Method.PUT, url, body, RequestType.DATA);
}

export function del<I, E, O>(
  url: string,
  body?: I
): T.Effect<RequestEnv, HttpError<E>, Response<O>> {
  return request(Method.DELETE, url, body);
}

export function delData<I extends ParsedUrlQueryInput, E, O>(
  url: string,
  body?: I
): T.Effect<RequestEnv, HttpError<E>, Response<O>> {
  return request(Method.DELETE, url, body, RequestType.DATA);
}

export function withHeaders(
  headers: Record<string, string>,
  replace = false
): <R, E, O>(
  eff: T.Effect<R, HttpError<E>, Response<O>>
) => T.Effect<R, HttpError<E>, Response<O>> {
  return <R, E, O>(eff: T.Effect<R, HttpError<E>, Response<O>>) =>
    replace
      ? T.provideR<R, HttpHeaders & R>(r => ({
          ...r,
          [ENV_URIS.HttpHeaders]: headers
        }))(eff)
      : T.provideR<R, HttpHeaders & R>(r => ({
          ...r,
          [ENV_URIS.HttpHeaders]: { ...r[ENV_URIS.HttpHeaders], ...headers }
        }))(eff);
}

export function withPathHeaders(
  headers: Record<string, string>,
  path: Predicate<string>,
  replace = false
): RequestMiddleware {
  return req => (m, u, b, r) =>
    path(u) ? withHeaders(headers, replace)(req(m, u, b, r)) : req(m, u, b, r);
}

function tryJson<A>(a: string): A | undefined {
  try {
    return JSON.parse(a);
  } catch (_) {
    return undefined;
  }
}

export const jsonDeserializer: HttpDeserializer = {
  [ENV_URIS.HttpDeserializer]: {
    errorResponse: tryJson,
    response: tryJson
  }
};
