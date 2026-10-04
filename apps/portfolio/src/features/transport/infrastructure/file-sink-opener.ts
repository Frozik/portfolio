import type { FileSinkType } from '@frozik/utils/file-sink/file-sink';
import { openFileSink } from '@frozik/utils/file-sink/open-file-sink';

import type { FileSinkOpener } from '../domain/ports/file-sink-opener';

const UNKNOWN_MIME = 'application/octet-stream';
/** What the save dialog accepts as an extension; anything else is offered without a filter. */
const EXTENSION = /\.([a-z0-9]{1,16})$/i;

/** The echo comes back as the same kind of file that went out: a PDF is saved as a PDF. */
export function fileSinkTypeOf(file: {
  readonly name: string;
  readonly type: string;
}): FileSinkType | undefined {
  const extension = EXTENSION.exec(file.name)?.[1];
  if (extension === undefined) {
    return undefined;
  }
  return {
    description: extension.toUpperCase(),
    mime: file.type === '' ? UNKNOWN_MIME : file.type,
    extension: `.${extension}`,
  };
}

/** The echo never buffers a whole file, so the in-memory download is not offered. */
export function createFileSinkOpener(streamSaverMitmUrl: string): FileSinkOpener {
  return file =>
    openFileSink({
      name: file.name,
      type: fileSinkTypeOf(file),
      streamSaverMitmUrl,
      allowBuffered: false,
    });
}
