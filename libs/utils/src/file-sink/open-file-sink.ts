import { isNil } from 'lodash-es';

import { assertNever } from '../assert/assertNever';
import { openBlobDownloadSink } from './blob-download-sink';
import type { FileSinkOpening, FileSinkOptions, FileSinkStrategy } from './file-sink';
import { openFileSystemAccessSink } from './file-system-access-sink';
import { openStreamSaverSink } from './stream-saver-sink';
import './save-file-picker';

/** Native save dialog where it exists, a streamed download where a service worker can run, a buffered one otherwise. */
export function fileSinkStrategy(
  options: Pick<FileSinkOptions, 'streamSaverMitmUrl' | 'allowBuffered'>
): FileSinkStrategy | undefined {
  if (typeof window !== 'undefined' && !isNil(window.showSaveFilePicker)) {
    return 'file-system-access';
  }
  if (options.streamSaverMitmUrl !== null && canRunServiceWorker()) {
    return 'stream-saver';
  }
  return options.allowBuffered ? 'blob-download' : undefined;
}

/**
 * Opens the destination file now and hands back a writable to fill later.
 * Call it from the user's click: the save dialog needs that gesture, and it
 * is gone once anything else has been awaited.
 */
export async function openFileSink(options: FileSinkOptions): Promise<FileSinkOpening> {
  const strategy = fileSinkStrategy(options);
  if (strategy === undefined) {
    return { kind: 'unavailable' };
  }
  switch (strategy) {
    case 'file-system-access':
      return openFileSystemAccessSink(options);
    case 'stream-saver':
      return openStreamSaverSink(options);
    case 'blob-download':
      return openBlobDownloadSink(options);
    default:
      return assertNever(strategy);
  }
}

function canRunServiceWorker(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof isSecureContext === 'boolean' &&
    isSecureContext
  );
}
