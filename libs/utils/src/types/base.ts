export type Assign<A, B> = Omit<A, keyof B> & B;

export type Nil = null | undefined;

export type Opaque<Type, BaseType> = BaseType & {
  readonly __type__: Type;
  readonly __baseType__: BaseType;
};

// biome-ignore lint/suspicious/noExplicitAny: any required for generic Opaque type extraction
export type Unopaque<O extends Opaque<any, any>> = O extends Opaque<any, infer T> ? T : never;

export type Primitive = string | number | boolean | null | undefined;
