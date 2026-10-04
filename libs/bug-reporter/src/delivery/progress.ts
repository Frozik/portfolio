/** Passes the archive through untouched while reporting how many bytes have gone to disk. */
export function countBytes(
  onProgress: (writtenBytes: number) => void
): TransformStream<Uint8Array, Uint8Array> {
  let written = 0;
  return new TransformStream({
    transform(chunk, controller) {
      written += chunk.byteLength;
      onProgress(written);
      controller.enqueue(chunk);
    },
  });
}
