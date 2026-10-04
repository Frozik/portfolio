import { isNil } from 'lodash-es';
import '../platform/browser-apis';

import type { IReportSink, TSaveOutcome } from '../core/ports';
import { countBytes } from './progress';

const ZIP_TYPE = { description: 'Zip archive', accept: { 'application/zip': ['.zip'] } } as const;

/** Chromium's native save dialog: the archive streams straight into the chosen file. */
export class FileSystemAccessSink implements IReportSink {
  readonly strategy = 'file-system-access';

  static isAvailable(): boolean {
    return typeof window !== 'undefined' && !isNil(window.showSaveFilePicker);
  }

  async save(
    fileName: string,
    archive: ReadableStream<Uint8Array>,
    onProgress: (writtenBytes: number) => void
  ): Promise<TSaveOutcome> {
    const showSaveFilePicker = window.showSaveFilePicker;
    if (isNil(showSaveFilePicker)) {
      throw new Error('showSaveFilePicker is not available');
    }
    let handle: FileSystemFileHandle;
    try {
      handle = await showSaveFilePicker.call(window, {
        suggestedName: fileName,
        types: [ZIP_TYPE],
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        await archive.cancel();
        return 'cancelled';
      }
      throw error;
    }
    const writable = await handle.createWritable();
    await archive.pipeThrough(countBytes(onProgress)).pipeTo(writable);
    return 'saved';
  }
}
