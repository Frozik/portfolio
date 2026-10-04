/**
 * One HTTP-like exchange travels over one bidirectional stream as
 * `HEAD · DATA* · END`. HEAD and END carry JSON, DATA carries raw bytes.
 */
export type Frame =
  | { readonly kind: 'head'; readonly json: unknown }
  | { readonly kind: 'data'; readonly bytes: Uint8Array }
  | { readonly kind: 'end'; readonly json: unknown };

export const FRAME_HEADER_BYTES = 5;
export const MAX_JSON_FRAME_BYTES = 16 * 1024;
export const MAX_DATA_FRAME_BYTES = 64 * 1024;

export const FRAME_TYPE = {
  head: 1,
  data: 2,
  end: 3,
} as const;

export class FrameProtocolError extends Error {
  override readonly name = 'FrameProtocolError';
}
