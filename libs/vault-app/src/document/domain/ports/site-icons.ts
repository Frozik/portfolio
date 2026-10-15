/** What asking for a site's icon came to: a 64×64 PNG, the site has none, or no answer now. */
type TSiteIconFetch =
  | { readonly kind: 'icon'; readonly png: Uint8Array<ArrayBuffer> }
  | { readonly kind: 'none' }
  | { readonly kind: 'failed' };

export type TFetchSiteIcon = (domain: string, signal: AbortSignal) => Promise<TSiteIconFetch>;
