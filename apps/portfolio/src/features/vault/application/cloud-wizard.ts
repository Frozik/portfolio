import { isNil } from 'lodash-es';

import type { GoogleDriveConnectForm } from './GoogleDriveConnectForm';
import type { WebDavConnectForm } from './WebDavConnectForm';

export type TChosenCloud =
  | { readonly kind: 'drive'; readonly form: GoogleDriveConnectForm }
  | { readonly kind: 'webdav'; readonly form: WebDavConnectForm };

/** Choose a cloud, connect to it, pick what to do with the folder; each step only once the one before is done. */
export type TCloudStep =
  | { readonly kind: 'choose' }
  | { readonly kind: 'connect'; readonly cloud: TChosenCloud }
  | { readonly kind: 'pick'; readonly cloud: TChosenCloud };

function isReached(cloud: TChosenCloud): boolean {
  return cloud.kind === 'drive'
    ? cloud.form.check.kind === 'found'
    : cloud.form.check.kind === 'reachable';
}

export function cloudStep(
  driveForm: GoogleDriveConnectForm | null,
  webDavForm: WebDavConnectForm | null
): TCloudStep {
  const cloud: TChosenCloud | null = !isNil(driveForm)
    ? { kind: 'drive', form: driveForm }
    : !isNil(webDavForm)
      ? { kind: 'webdav', form: webDavForm }
      : null;
  if (isNil(cloud)) {
    return { kind: 'choose' };
  }
  return { kind: isReached(cloud) ? 'pick' : 'connect', cloud };
}
