import { withRetry } from '@frozik/cloud-storage/core/with-retry';
import { createWebDavProvider } from '@frozik/cloud-storage/webdav/webdav-provider';
import { createWebDavTransport } from '@frozik/cloud-storage/webdav/webdav-transport';
import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';

import type { TConnectCloud } from '../domain/ports/cloud';
import { openGoogleDrive } from './google-drive';

export const connectCloud: TConnectCloud = (location, secrets) => {
  switch (location.kind) {
    case 'google-drive': {
      const drive = openGoogleDrive(location.space);
      return { location, storage: drive.storage, googleAuth: drive.auth };
    }
    case 'webdav':
      return isNil(secrets)
        ? null
        : {
            location,
            storage: withRetry(
              createWebDavProvider({
                transport: createWebDavTransport({
                  endpoint: location.url,
                  username: location.username,
                  password: secrets.password,
                }),
                features: secrets.features,
              })
            ),
            googleAuth: null,
          };
    default:
      return assertNever(location);
  }
};
