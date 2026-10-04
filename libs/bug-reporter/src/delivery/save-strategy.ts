import type { IReportSink } from '../core/ports';
import { BlobDownloadSink } from './blob-download';
import { FileSystemAccessSink } from './file-system-access';
import { StreamSaverSink } from './stream-saver';

export interface ISaveStrategyOptions {
  /** Same-origin URL of StreamSaver's `mitm.html`; without it the StreamSaver tier is skipped. */
  readonly streamSaverMitmUrl: string | null;
}

/** Native file picker where it exists, a streamed download where a service worker can run, a buffered download otherwise. */
export function createReportSink(options: ISaveStrategyOptions): IReportSink {
  if (FileSystemAccessSink.isAvailable()) {
    return new FileSystemAccessSink();
  }
  if (options.streamSaverMitmUrl !== null && StreamSaverSink.isAvailable()) {
    return new StreamSaverSink(options.streamSaverMitmUrl);
  }
  return new BlobDownloadSink();
}
