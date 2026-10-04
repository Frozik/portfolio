import { assert } from '@frozik/utils/assert/assert';
import { fileSinkStrategy, openFileSink } from '@frozik/utils/file-sink/open-file-sink';

import type { IReportSink } from '../core/ports';
import { countBytes } from './progress';

export interface ISaveStrategyOptions {
  /** Same-origin URL of StreamSaver's `mitm.html`; without it the StreamSaver tier is skipped. */
  readonly streamSaverMitmUrl: string | null;
}

const ZIP_TYPE = {
  description: 'Zip archive',
  mime: 'application/zip',
  extension: '.zip',
} as const;

/** Saves the archive through the best file sink the browser offers; a report is small enough to buffer as a last resort. */
export function createReportSink({ streamSaverMitmUrl }: ISaveStrategyOptions): IReportSink {
  const strategy = fileSinkStrategy({ streamSaverMitmUrl, allowBuffered: true });
  assert(strategy !== undefined, 'a buffered download is always possible');
  return {
    strategy,
    async save(fileName, archive, onProgress) {
      const opening = await openFileSink({
        name: fileName,
        type: ZIP_TYPE,
        streamSaverMitmUrl,
        allowBuffered: true,
      });
      if (opening.kind !== 'opened') {
        await archive.cancel();
        return 'cancelled';
      }
      await archive.pipeThrough(countBytes(onProgress)).pipeTo(opening.writable);
      return 'saved';
    },
  };
}
