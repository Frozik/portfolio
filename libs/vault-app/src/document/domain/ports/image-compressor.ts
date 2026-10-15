/** A photo made small enough to live in the vault: JPEG, long side ≤ 2000 px. */
export interface IImageCompressor {
  /** `null` when the bytes are not an image the browser can draw; the original is kept then. */
  compress(
    bytes: Uint8Array<ArrayBuffer>,
    mime: string
  ): Promise<{ readonly bytes: Uint8Array<ArrayBuffer>; readonly mime: string } | null>;
}
