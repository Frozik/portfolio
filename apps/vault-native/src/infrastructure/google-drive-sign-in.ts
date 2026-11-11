import type { TDriveSpace } from '@frozik/cloud-storage/google-drive/drive-space';
import { DRIVE_SCOPES } from '@frozik/cloud-storage/google-drive/drive-space';
import { driveAccountOf } from '@frozik/expo-google-authorization/drive-account';
import {
  googleAuthorization,
  NETWORK_ERROR,
} from '@frozik/expo-google-authorization/google-authorization';
import { assertNever } from '@frozik/utils/assert/assertNever';
import { err, ok } from '@frozik/utils/result/result';
import { getItem, setItem } from 'expo-secure-store';

import type { IGoogleDriveAuth } from '@frozik/vault-app/cloud/domain/ports/google-drive';
import type {
  IDiagnosticsNote,
  TDiagnosticsLevel,
} from '@frozik/vault-app/diagnostics/domain/diagnostics-entry';

const ACCOUNT_KEY = 'google-drive-account';

function chosenAccount(): string | null {
  const account = getItem(ACCOUNT_KEY);
  return account === '' ? null : account;
}

/**
 * Drive with a Google account already on the phone: Android's account picker and consent screen
 * at sign-in, a silent token after it. The account chosen last is the one every Drive vault on
 * this phone syncs through. The log gets Google's status code of a failure, never the account or
 * Google's message, which may name it.
 */
export const googleDriveSignIn =
  (note: (made: IDiagnosticsNote) => void) =>
  (space: TDriveSpace): IGoogleDriveAuth => {
    const signIn = (
      level: TDiagnosticsLevel,
      event: string,
      fields: Readonly<Record<string, string>> = {}
    ) => note({ level, category: 'cloud', event, fields: { space, ...fields } });
    const authorization = googleAuthorization({
      scopes: [DRIVE_SCOPES[space]],
      account: chosenAccount,
    });
    return {
      token: authorization.token,
      invalidate: authorization.invalidate,
      prepare: () => Promise.resolve(true),
      async authorize() {
        const answer = await authorization.connect(true);
        switch (answer.kind) {
          case 'authorized':
            signIn('info', 'google-signed-in');
            setItem(ACCOUNT_KEY, answer.account ?? (await driveAccountOf(answer.token)) ?? '');
            return ok(undefined);
          case 'cancelled':
            signIn('info', 'google-sign-in-cancelled');
            return err('popup-closed');
          case 'needs-consent':
            signIn('warn', 'google-scope-denied');
            return err('scope-denied');
          case 'failed':
            signIn('error', 'google-sign-in-failed', { code: String(answer.code ?? 'none') });
            return err(answer.code === NETWORK_ERROR ? 'unavailable' : 'refused');
          default:
            return assertNever(answer);
        }
      },
    };
  };
