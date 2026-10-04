import type { IReportSink, TSaveOutcome } from '../core/ports';
import { countBytes } from './progress';

/** The browser is given a revoke grace period: Safari cancels a download whose URL vanishes too soon. */
const REVOKE_DELAY_MS = 60_000;

/** Universal fallback: the whole archive is buffered in memory and handed to a download link. */
export class BlobDownloadSink implements IReportSink {
  readonly strategy = 'blob-download';

  async save(
    fileName: string,
    archive: ReadableStream<Uint8Array>,
    onProgress: (writtenBytes: number) => void
  ): Promise<TSaveOutcome> {
    const blob = await new Response(archive.pipeThrough(countBytes(onProgress))).blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = 'noopener';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
    return 'saved';
  }
}
