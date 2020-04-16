import { eff as EFF } from "@matechs/effect";

export interface SyncRE<R, E, A> extends EFF.SyncEff<R, E, A> {}
export interface SyncE<E, A> extends EFF.SyncEff<unknown, E, A> {}
export interface SyncR<R, A> extends EFF.SyncEff<R, never, A> {}
export interface Sync<A> extends EFF.SyncEff<unknown, never, A> {}

export interface AsyncRE<R, E, A> extends EFF.AsyncEff<R, E, A> {}
export interface AsyncE<E, A> extends EFF.AsyncEff<unknown, E, A> {}
export interface AsyncR<R, A> extends EFF.AsyncEff<R, never, A> {}
export interface Async<A> extends EFF.AsyncEff<unknown, never, A> {}

export type Any<R = any, E = any, A = any> = EFF.AsyncEff<R, E, A> | EFF.SyncEff<R, E, A>;
export type AnySync<R = any, E = any, A = any> = EFF.SyncEff<R, E, A>;
export type AnyAsync<R = any, E = any, A = any> = EFF.AsyncEff<R, E, A>;

export type R<K extends Any> = K extends Any<infer _R, infer _E, infer _A> ? _R : never;
export type E<K extends Any> = K extends Any<infer _R, infer _E, infer _A> ? _E : never;
export type A<K extends Any> = K extends Any<infer _R, infer _E, infer _A> ? _A : never;
