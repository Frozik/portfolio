import { withRetry } from '@frozik/cloud-storage/core/with-retry';
import type { TDriveSpace } from '@frozik/cloud-storage/google-drive/drive-space';
import { createDriveTransport } from '@frozik/cloud-storage/google-drive/drive-transport';
import { createGoogleDriveProvider } from '@frozik/cloud-storage/google-drive/google-drive-provider';

import type {
  IGoogleDriveAuth,
  TOpenGoogleDrive,
} from '@frozik/vault-app/cloud/domain/ports/google-drive';

/** Drive over fetch; each platform brings its own Google sign-in. */
export function googleDriveOpener(
  authOf: (space: TDriveSpace) => IGoogleDriveAuth
): TOpenGoogleDrive {
  return space => {
    const auth = authOf(space);
    return {
      auth,
      storage: withRetry(
        createGoogleDriveProvider({ transport: createDriveTransport(auth), space })
      ),
    };
  };
}
