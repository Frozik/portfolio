/**
 * A stream whose source is opened on first read. The save dialog must open
 * inside the click's user activation, while assembling the report takes an
 * async moment; handing the sink this stream lets the dialog come first.
 */
export function deferStream(
  open: () => Promise<ReadableStream<Uint8Array>>
): ReadableStream<Uint8Array> {
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  return new ReadableStream({
    async pull(controller) {
      reader ??= (await open()).getReader();
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      controller.enqueue(value);
    },
    cancel(reason) {
      return reader?.cancel(reason);
    },
  });
}
