import type { TDriveSpace } from '@frozik/cloud-storage/google-drive/drive-space';
import { DRIVE_SCOPES } from '@frozik/cloud-storage/google-drive/drive-space';
import type { Milliseconds } from '@frozik/utils/date/types';
import { err, ok } from '@frozik/utils/result/result';
import { isNil } from 'lodash-es';
import { Temporal } from 'temporal-polyfill';

import type {
  IGoogleDriveAuth,
  TGoogleAuthFailure,
} from '@frozik/vault-app/cloud/domain/ports/google-drive';
import { loadGoogleOauth2 } from './google-identity-script';

const SECOND_MS = 1000;
/** A token this close to expiry is treated as gone, so a request never starts with one that dies mid-way. */
const EXPIRY_MARGIN_MS = 60_000;

function nowMs(): Milliseconds {
  return Temporal.Now.instant().epochMilliseconds as Milliseconds;
}

function failureOf(type: IGoogleTokenClientError['type']): TGoogleAuthFailure {
  switch (type) {
    case 'popup_failed_to_open':
      return 'popup-blocked';
    case 'popup_closed':
      return 'popup-closed';
    default:
      return 'refused';
  }
}

/**
 * The GIS token model for one Drive space: no refresh token,
 * a new token only from a click. The token stays in memory, like the vault key.
 */
export function createGoogleDriveAuth(
  clientId: string,
  space: TDriveSpace,
  now: () => Milliseconds = nowMs
): IGoogleDriveAuth {
  const scope = DRIVE_SCOPES[space];
  let oauth2: IGoogleAccountsOauth2 | null = null;
  let current: { readonly token: string; readonly expiresAt: Milliseconds } | null = null;

  return {
    prepare: async () => {
      oauth2 = await loadGoogleOauth2();
      return !isNil(oauth2) && clientId !== '';
    },
    authorize: () =>
      new Promise(resolve => {
        const loaded = oauth2;
        if (isNil(loaded) || clientId === '') {
          resolve(err('unavailable'));
          return;
        }
        loaded
          .initTokenClient({
            client_id: clientId,
            scope,
            callback: response => {
              const token = response.access_token;
              if (isNil(token) || !isNil(response.error)) {
                resolve(err('refused'));
                return;
              }
              if (!loaded.hasGrantedAllScopes(response, scope)) {
                resolve(err('scope-denied'));
                return;
              }
              current = {
                token,
                expiresAt: (now() + Number(response.expires_in ?? 0) * SECOND_MS) as Milliseconds,
              };
              resolve(ok(undefined));
            },
            error_callback: error => resolve(err(failureOf(error.type))),
          })
          .requestAccessToken({ prompt: '' });
      }),
    token: () =>
      Promise.resolve(
        !isNil(current) && current.expiresAt - EXPIRY_MARGIN_MS > now()
          ? ok(current.token)
          : err({ kind: 'auth-required' })
      ),
    invalidate: () => {
      current = null;
    },
  };
}
