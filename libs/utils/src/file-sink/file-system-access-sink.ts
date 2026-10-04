import { isNil } from 'lodash-es';

import type { FileSinkOpening, FileSinkOptions } from './file-sink';
import './save-file-picker';

/** Chromium's native save dialog: the stream goes straight into the chosen file. */
export async function openFileSystemAccessSink({
  name,
  type,
}: FileSinkOptions): Promise<FileSinkOpening> {
  const showSaveFilePicker = window.showSaveFilePicker;
  if (isNil(showSaveFilePicker)) {
    return { kind: 'unavailable' };
  }
  try {
    const handle = await showSaveFilePicker.call(window, {
      suggestedName: name,
      types:
        type === undefined
          ? undefined
          : [{ description: type.description, accept: { [type.mime]: [type.extension] } }],
    });
    return {
      kind: 'opened',
      strategy: 'file-system-access',
      writable: await handle.createWritable(),
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { kind: 'cancelled' };
    }
    throw error;
  }
}
