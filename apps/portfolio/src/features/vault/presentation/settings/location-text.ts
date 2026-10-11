import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';

import type { TCloudLocation } from '../../domain/cloud-files';

import { cloudT } from '../translations/cloud';

/** Where a vault is kept, in words: the provider and the path or address, never a credential. */
export function locationText(location: TCloudLocation | null): string {
  const t = cloudT.section;
  if (isNil(location)) {
    return t.localOnly;
  }
  switch (location.kind) {
    case 'google-drive':
      return t.driveIn(cloudT.drive.spaces[location.space].label, location.path);
    case 'webdav':
      return t.webdavIn(location.url, location.path);
    default:
      return assertNever(location);
  }
}
