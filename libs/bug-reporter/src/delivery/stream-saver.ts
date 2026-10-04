import type { IReportSink, TSaveOutcome } from '../core/ports';
import { countBytes } from './progress';

/**
 * StreamSaver.js: a service worker turns the stream into a download the
 * browser writes to disk as it arrives. `mitmUrl` must point at a same-origin
 * copy of the library's `mitm.html` (with `sw.js` beside it); the library is
 * loaded on demand because the page may never need it.
 */
export class StreamSaverSink implements IReportSink {
  readonly strategy = 'stream-saver';

  constructor(private readonly mitmUrl: string) {}

  static isAvailable(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator &&
      typeof isSecureContext === 'boolean' &&
      isSecureContext
    );
  }

  async save(
    fileName: string,
    archive: ReadableStream<Uint8Array>,
    onProgress: (writtenBytes: number) => void
  ): Promise<TSaveOutcome> {
    const streamSaver = await import('streamsaver');
    streamSaver.mitm = this.mitmUrl;
    const writable = streamSaver.createWriteStream(fileName);
    await archive.pipeThrough(countBytes(onProgress)).pipeTo(writable);
    return 'saved';
  }
}
