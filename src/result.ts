type Left<T> = { ok: T; err?: never };

type Right<U> = { ok?: never; err: U };

export type Result<T, U> = NonNullable<Left<T> | Right<U>>;
