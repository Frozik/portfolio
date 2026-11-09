/** Why a mask does not parse; `position` is the index of the offending character in the source. */
export type TMaskError =
  | { readonly kind: 'empty' }
  | { readonly kind: 'plus-not-first'; readonly position: number }
  | { readonly kind: 'quantifier-without-symbol'; readonly position: number }
  | { readonly kind: 'quantifier-after-star'; readonly position: number }
  | { readonly kind: 'quantifier-malformed'; readonly position: number }
  | { readonly kind: 'quantifier-min-above-max'; readonly position: number }
  | { readonly kind: 'unbalanced-parenthesis'; readonly position: number }
  | { readonly kind: 'quantifier-after-parenthesis'; readonly position: number }
  | { readonly kind: 'unexpected-character'; readonly position: number }
  | { readonly kind: 'dangling-escape'; readonly position: number }
  | { readonly kind: 'too-long'; readonly maximum: number };
