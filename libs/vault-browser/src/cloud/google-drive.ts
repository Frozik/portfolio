import type { TOpenGoogleDrive } from '@frozik/vault-app/cloud/domain/ports/google-drive';
import { googleDriveOpener } from '@frozik/vault-http/cloud/google-drive';
import { createGoogleDriveAuth } from './google-drive-auth';

/** Drive under the app's own OAuth client: sign-in elsewhere on the site never asks for Drive. */
export function createGoogleDriveOpener(clientId: string): TOpenGoogleDrive {
  return googleDriveOpener(space => createGoogleDriveAuth(clientId, space));
}
