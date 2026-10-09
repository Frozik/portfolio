export type Assign<A, B> = Omit<A, keyof B> & B;

export type Nil = null | undefined;

declare const brand: unique symbol;

/** A nominal type over a structural one: assignable to `Base`, never from it without a cast. */
export type Brand<Base, Tag> = Base & {
  readonly [brand]: { readonly tag: Tag; readonly base: Base };
};

/** The type a brand was put on: `Unbrand<Meters>` is `number`; unbranded members of a union pass through. */
export type Unbrand<Type> = Type extends { readonly [brand]: { readonly base: infer Base } }
  ? Base
  : Type;

export type Primitive = string | number | boolean | null | undefined;
