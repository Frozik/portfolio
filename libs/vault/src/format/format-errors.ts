/** Every way opening or reading a vault file can fail, as values. */
export type TFormatError =
  | { readonly kind: 'wrong-password' }
  | { readonly kind: 'slot-tampered' }
  | { readonly kind: 'key-rotated' }
  | { readonly kind: 'corrupted' }
  | { readonly kind: 'unsupported-format' }
  | { readonly kind: 'rollback-security' }
  | { readonly kind: 'zip-limits' }
  | { readonly kind: 'asset-missing' };
