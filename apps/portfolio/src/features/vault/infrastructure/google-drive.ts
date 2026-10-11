import { withRetry } from '@frozik/cloud-storage/core/with-retry';
import { createDriveTransport } from '@frozik/cloud-storage/google-drive/drive-transport';
import { createGoogleDriveProvider } from '@frozik/cloud-storage/google-drive/google-drive-provider';

import type { TOpenGoogleDrive } from '../domain/ports/google-drive';
import { createGoogleDriveAuth } from './google-drive-auth';

/** The vault's own OAuth client: sign-in elsewhere on the site never asks for Drive. */
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_VAULT_CLIENT_ID ?? '';

export const openGoogleDrive: TOpenGoogleDrive = space => {
  const auth = createGoogleDriveAuth(GOOGLE_CLIENT_ID, space);
  return {
    auth,
    storage: withRetry(createGoogleDriveProvider({ transport: createDriveTransport(auth), space })),
  };
};
