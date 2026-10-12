import type { TStorageResult } from '@frozik/cloud-storage/core/storage-error';
import { withRetry } from '@frozik/cloud-storage/core/with-retry';
import { DRIVE_SCOPES } from '@frozik/cloud-storage/google-drive/drive-space';
import {
  createDriveTransport,
  DRIVE_API,
} from '@frozik/cloud-storage/google-drive/drive-transport';
import { createGoogleDriveProvider } from '@frozik/cloud-storage/google-drive/google-drive-provider';
import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';
import { get, isNil } from 'lodash-es';
import { Temporal } from 'temporal-polyfill';
import { browser } from 'wxt/browser';
import { z } from 'zod';

import type { IDriveSignInFailure } from '../domain/cloud';
import type { IGoogleDriveAccess } from '../domain/ports';

/** The web app's OAuth client: `drive.file` shows an app only the files its own client made. */
const CLIENT_ID = import.meta.env.VITE_GOOGLE_VAULT_CLIENT_ID ?? '';
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_KEY = 'google-drive-token';
const SECOND_MS = 1000;
/** A token this close to expiry is treated as gone, so a request never starts with one that dies mid-way. */
const EXPIRY_MARGIN_MS = 60_000;
/** Google answers a renewal without a window by a redirect or two; past this the user has to sign in. */
const SILENT_RENEWAL_MS = 10_000;

const TOKEN_SCHEMA = z.object({ scope: z.string(), token: z.string(), expiresAt: z.number() });

type TStoredToken = z.infer<typeof TOKEN_SCHEMA>;

function now(): number {
  return Temporal.Now.instant().epochMilliseconds;
}

async function storedToken(scope: string): Promise<string | null> {
  const parsed = TOKEN_SCHEMA.safeParse((await browser.storage.session.get(TOKEN_KEY))[TOKEN_KEY]);
  return parsed.success && parsed.data.scope === scope && parsed.data.expiresAt > now()
    ? parsed.data.token
    : null;
}

/**
 * Google's implicit flow back to `https://<id>.chromiumapp.org/`: a
 * window that picks the account when none is known, nothing on screen when
 * renewing silently for a known one.
 */
function authUrl(scope: string, account: string | null, interactive: boolean): string {
  const url = new URL(AUTH_URL);
  const prompt = interactive ? (isNil(account) ? 'select_account' : null) : 'none';
  url.search = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'token',
    redirect_uri: browser.identity.getRedirectURL(),
    scope,
    include_granted_scopes: 'true',
    ...(isNil(account) ? {} : { login_hint: account }),
    ...(isNil(prompt) ? {} : { prompt }),
  }).toString();
  return url.toString();
}

/** Chrome's words when the user closes the window. */
const CLOSED_BY_USER = /did not approve/i;

function failureOfFlow(error: unknown): IDriveSignInFailure {
  const detail = error instanceof Error ? error.message : String(error);
  return { kind: CLOSED_BY_USER.test(detail) ? 'cancelled' : 'failed', detail };
}

/** Google answers in the fragment: the token, or `error` with its description. */
function tokenOf(redirected: string, scope: string): TResult<TStoredToken, IDriveSignInFailure> {
  const answer = new URLSearchParams(new URL(redirected).hash.slice(1));
  const token = answer.get('access_token');
  const refused = answer.get('error');
  if (!isNil(refused)) {
    const description = answer.get('error_description');
    return err({
      kind: 'refused',
      detail: isNil(description) ? refused : `${refused}: ${description}`,
    });
  }
  const granted = answer.get('scope') ?? '';
  if (isNil(token) || !granted.split(' ').includes(scope)) {
    return err({ kind: 'refused', detail: `no ${scope} in “${granted}”` });
  }
  const expiresIn = Number(answer.get('expires_in') ?? 0) * SECOND_MS;
  return ok({ scope, token, expiresAt: now() + expiresIn - EXPIRY_MARGIN_MS });
}

/** The token, kept in `storage.session` (memory, closed to content scripts) for the worker's next wake. */
async function authorize(
  scope: string,
  account: string | null,
  interactive: boolean
): Promise<TResult<string, IDriveSignInFailure>> {
  if (CLIENT_ID === '') {
    return err({ kind: 'unavailable', detail: null });
  }
  let redirected: string | undefined;
  try {
    redirected = await browser.identity.launchWebAuthFlow({
      url: authUrl(scope, account, interactive),
      interactive,
      abortOnLoadForNonInteractive: false,
      timeoutMsForNonInteractive: SILENT_RENEWAL_MS,
    });
  } catch (error) {
    return err(failureOfFlow(error));
  }
  if (isNil(redirected)) {
    return err({ kind: 'failed', detail: 'no answer' });
  }
  const token = tokenOf(redirected, scope);
  if (!token.ok) {
    return token;
  }
  await browser.storage.session.set({ [TOKEN_KEY]: token.value });
  return ok(token.value.token);
}

/** The signed-in account, for the silent renewals; every Drive scope may ask Drive who it is. */
async function accountOf(token: string): Promise<string | null> {
  const answer = await fetch(`${DRIVE_API}/about?fields=user(emailAddress)`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
    credentials: 'omit',
  }).catch(() => null);
  const about: unknown = answer?.ok === true ? await answer.json().catch(() => null) : null;
  const email: unknown = get(about, ['user', 'emailAddress']);
  return typeof email === 'string' ? email : null;
}

/** Google sign-in through `chrome.identity`, and Drive with the token it gives. */
export const CHROME_GOOGLE_DRIVE: IGoogleDriveAccess = {
  async signIn(space, account) {
    const signedIn = await authorize(DRIVE_SCOPES[space], account, true);
    return signedIn.ok ? ok(account ?? (await accountOf(signedIn.value))) : signedIn;
  },
  open(space, account) {
    const scope = DRIVE_SCOPES[space];
    const tokens = {
      token: async (): Promise<TStorageResult<string>> => {
        const stored = await storedToken(scope);
        if (!isNil(stored)) {
          return ok(stored);
        }
        const renewed = await authorize(scope, account, false);
        return renewed.ok ? ok(renewed.value) : err({ kind: 'auth-required' });
      },
      invalidate: () => {
        void browser.storage.session.remove(TOKEN_KEY);
      },
    };
    return withRetry(createGoogleDriveProvider({ transport: createDriveTransport(tokens), space }));
  },
};
