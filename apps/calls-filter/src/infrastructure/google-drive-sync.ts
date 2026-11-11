import { withRetry } from '@frozik/cloud-storage/core/with-retry';
import { DRIVE_SCOPES } from '@frozik/cloud-storage/google-drive/drive-space';
import { createDriveTransport } from '@frozik/cloud-storage/google-drive/drive-transport';
import { createGoogleDriveProvider } from '@frozik/cloud-storage/google-drive/google-drive-provider';
import { driveAccountOf } from '@frozik/expo-google-authorization/drive-account';
import { googleAuthorization } from '@frozik/expo-google-authorization/google-authorization';
import { assertNever } from '@frozik/utils/assert/assertNever';

import type { ICloudCopy } from '../contexts/sync/domain/ports/cloud-copy';
import type { IGoogleAccount } from '../contexts/sync/domain/ports/google-account';
import { driveCloudCopy } from './drive-cloud-copy';

/** Only the app's hidden folder: the user's own files stay out of reach. */
const SCOPES = [DRIVE_SCOPES['app-data']];
/** The cloud copy in the hidden folder of an account's Drive, with the phone's own sign-in. */
export function googleDriveCloudOf(account: string | null): ICloudCopy {
  const auth = googleAuthorization({ scopes: SCOPES, account: () => account });
  return driveCloudCopy(
    withRetry(
      createGoogleDriveProvider({ transport: createDriveTransport(auth), space: 'app-data' })
    )
  );
}

/** Connecting picks one of the Google accounts already on the phone; no password, ever. */
export const GOOGLE_DRIVE_ACCOUNT: IGoogleAccount = {
  async connect() {
    const answer = await googleAuthorization({ scopes: SCOPES, account: () => null }).connect(true);
    switch (answer.kind) {
      case 'authorized':
        return {
          kind: 'connected',
          account: answer.account ?? (await driveAccountOf(answer.token)),
        };
      case 'cancelled':
        return { kind: 'cancelled' };
      case 'needs-consent':
        return { kind: 'failed', reason: 'needs-consent' };
      case 'failed':
        return { kind: 'failed', reason: `${answer.code ?? '?'} ${answer.message ?? ''}`.trim() };
      default:
        return assertNever(answer);
    }
  },
  async disconnect(account) {
    if (account !== null) {
      await googleAuthorization({ scopes: SCOPES, account: () => account }).disconnect(account);
    }
  },
};
