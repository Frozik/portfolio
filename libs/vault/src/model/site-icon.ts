import type { IHlc } from './hlc';

/**
 * A site's icon, kept once per domain in the vault: the picture
 * (64×64 PNG), or the note that the site has none, asked again after a while.
 */
export type TSiteIcon =
  | { readonly kind: 'icon'; readonly png: Uint8Array<ArrayBuffer>; readonly at: IHlc }
  | { readonly kind: 'none'; readonly at: IHlc };
