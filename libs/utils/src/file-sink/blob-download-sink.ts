import type { FileSinkOpening, FileSinkOptions } from './file-sink';

/** The browser is given a revoke grace period: Safari cancels a download whose URL vanishes too soon. */
const REVOKE_DELAY_MS = 60_000;

/** Universal fallback: the whole file is buffered in memory and handed to a download link on close. */
export function openBlobDownloadSink({ name, type }: FileSinkOptions): FileSinkOpening {
  const parts: Uint8Array<ArrayBuffer>[] = [];
  return {
    kind: 'opened',
    strategy: 'blob-download',
    writable: new WritableStream<Uint8Array>({
      write(chunk) {
        parts.push(new Uint8Array(chunk));
      },
      close() {
        download(new Blob(parts, { type: type?.mime }), name);
      },
    }),
  };
}

function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.rel = 'noopener';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
}
