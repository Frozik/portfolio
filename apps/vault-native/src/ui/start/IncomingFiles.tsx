import { useEffect } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { useAppModel } from '../app-model';
import { useTakeInFile } from './useTakeInFile';

/** A file another app hands over ("Open with", "Share"), taken in as one picked on the first screen. */
export function IncomingFiles() {
  const { followIncomingFiles } = useAppModel();
  const takeInFile = useEventCallback(useTakeInFile());
  useEffect(() => followIncomingFiles(takeInFile), [followIncomingFiles, takeInFile]);
  return null;
}
