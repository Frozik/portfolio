import { withRetry } from '@frozik/cloud-storage/core/with-retry';
import { DRIVE_SCOPES } from '@frozik/cloud-storage/google-drive/drive-space';
import { createDriveTransport } from '@frozik/cloud-storage/google-drive/drive-transport';
import { createGoogleDriveProvider } from '@frozik/cloud-storage/google-drive/google-drive-provider';
import { googleAuthorization } from '@frozik/expo-google-authorization/google-authorization';
import { assertNever } from '@frozik/utils/assert/assertNever';
import { z } from 'zod';

import type { ICloudCopy } from '../contexts/sync/domain/ports/cloud-copy';
import type { IGoogleAccount } from '../contexts/sync/domain/ports/google-account';
import { driveCloudCopy } from './drive-cloud-copy';

/** Only the app's hidden folder: the user's own files stay out of reach. */
const SCOPES = [DRIVE_SCOPES['app-data']];
const DRIVE_ABOUT = z.object({ user: z.object({ emailAddress: z.string() }) });
const ABOUT_USER = 'https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)';

/** Google does not always name the account an authorization was given with; Drive does. */
async function driveAccountOf(token: string): Promise<string | null> {
  try {
    const response = await fetch(ABOUT_USER, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) {
      return null;
    }
    const about = DRIVE_ABOUT.safeParse(await response.json());
    return about.success ? about.data.user.emailAddress : null;
  } catch {
    // No network or no JSON: the account is shown without its address, nothing else depends on it.
    return null;
  }
}

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
