import type { IPlace } from '@frozik/tooling/src/android-e2e/screen.ts';
import { locateByDump, screenDriver } from '@frozik/tooling/src/android-e2e/screen.ts';

import { control } from './channel.mts';

/** Another app's resource id (`package:id/name`), as of Android's own permission dialog. */
const FOREIGN_ID = /:id\//;

/**
 * The app's own views are found through its e2e channel, natively, in milliseconds; another
 * app's — Android's permission dialog — from the screen dump, in two seconds.
 */
export const screen = screenDriver(id =>
  FOREIGN_ID.test(id)
    ? locateByDump(id)
    : // An app that is not answering — restarting after a revoked permission — shows nothing yet.
      control<IPlace | null>('locate', { id }).catch(() => null)
);
