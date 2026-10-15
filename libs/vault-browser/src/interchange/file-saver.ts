import { assertNever } from '@frozik/utils/assert/assertNever';
import { openFileSink } from '@frozik/utils/file-sink/open-file-sink';
import { isNil } from 'lodash-es';

import type { TSaveFile } from '@frozik/vault-app/interchange/domain/ports/file-saver';

const EXTENSION = /\.[a-z0-9]+$/i;

/**
 * Without a save picker (an iPhone, an Android phone) the share sheet is the
 * way a file leaves the app: to Files, a cloud, a message. It must open within
 * the click, so it is asked first, before anything else is awaited.
 */
async function sharedFile(file: File): Promise<'saved' | 'cancelled' | null> {
  if ('showSaveFilePicker' in window || navigator.canShare?.({ files: [file] }) !== true) {
    return null;
  }
  try {
    await navigator.share({ files: [file] });
    return 'saved';
  } catch (error) {
    return error instanceof DOMException && error.name === 'AbortError' ? 'cancelled' : null;
  }
}

/** An export is a few megabytes at most and already in memory: the buffered download is fine. */
export const saveFile: TSaveFile = async ({ name, mime, bytes }) => {
  const shared = await sharedFile(new File([bytes], name, { type: mime }));
  if (!isNil(shared)) {
    return shared;
  }
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
