import { assertNever } from '@frozik/utils/assert/assertNever';
import { openFileSink } from '@frozik/utils/file-sink/open-file-sink';

import type { TSaveFile } from '../domain/ports/file-saver';

const EXTENSION = /\.[a-z0-9]+$/i;

/** An export is a few megabytes at most and already in memory: the buffered download is fine. */
export const saveFile: TSaveFile = async ({ name, mime, bytes }) => {
  const extension = EXTENSION.exec(name)?.[0];
  const opening = await openFileSink({
    name,
    type:
      extension === undefined
        ? undefined
        : { description: extension.slice(1).toUpperCase(), mime, extension },
    streamSaverMitmUrl: null,
    allowBuffered: true,
  });
  switch (opening.kind) {
    case 'opened': {
      const writer = opening.writable.getWriter();
      await writer.write(bytes);
      await writer.close();
      return 'saved';
    }
    case 'cancelled':
    case 'unavailable':
      return opening.kind;
    default:
      return assertNever(opening);
  }
};
