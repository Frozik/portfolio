import {
  createFakeDriveServer,
  FAKE_TOKEN,
} from '@frozik/cloud-storage/google-drive/fake-drive-server.test-helper';
import type { BrowserContext, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { isNil } from 'lodash-es';

import { waitForApp } from './app-ready';

const DEMO_PASSWORD = 'demo';
const GIS_SCRIPT = 'https://accounts.google.com/gsi/client';
const DRIVE_HOSTS = 'https://www.googleapis.com/**';
const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE',
  'access-control-allow-headers':
    'authorization, content-type, x-upload-content-type, x-upload-content-length',
  'access-control-expose-headers': 'location',
};
const NO_CONTENT = 204;

/** Google Identity Services as far as the vault uses it: a token for whatever scope is asked. */
const GIS_STUB = `window.google = { accounts: { oauth2: {
  initTokenClient: config => ({ requestAccessToken: () => setTimeout(() =>
    config.callback({ access_token: '${FAKE_TOKEN}', expires_in: 3600, scope: config.scope })) }),
  hasGrantedAllScopes: () => true,
  revoke: () => undefined,
} } };`;

/** One Drive both browser profiles reach: Google's script and REST API answered from this test. */
async function useFakeGoogle(
  context: BrowserContext,
  drive: ReturnType<typeof createFakeDriveServer>
): Promise<void> {
  await context.route(GIS_SCRIPT, route =>
    route.fulfill({ contentType: 'text/javascript', body: GIS_STUB })
  );
  await context.route(DRIVE_HOSTS, async route => {
    const request = route.request();
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: NO_CONTENT, headers: CORS_HEADERS });
      return;
    }
    const posted = request.postDataBuffer();
    const response = await drive.fetch(request.url(), {
      method: request.method(),
      headers: await request.allHeaders(),
      body: isNil(posted) ? undefined : Uint8Array.from(posted),
    });
    await route.fulfill({
      status: response.status,
      headers: { ...Object.fromEntries(response.headers), ...CORS_HEADERS },
      body: Buffer.from(await response.arrayBuffer()),
    });
  });
}

async function signInToDrive(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Connect Google Drive…' }).click();
  await page.getByRole('button', { name: 'Sign in with Google' }).click();
}

// plan task 20 — a vault kept in Drive on one browser profile opens on
// another and brings its cards; Drive is a fake behind `page.route`.
test('a vault kept in Google Drive opens in a second browser profile with its cards', async ({
  browser,
}) => {
  const drive = createFakeDriveServer();
  const first = await browser.newContext();
  await useFakeGoogle(first, drive);
  const page = await first.newPage();
  await page.goto('vault');
  await waitForApp(page);
  await page.getByRole('button', { name: 'Try the demo' }).click();
  await expect(page.getByRole('option', { name: /GitHub/ })).toBeVisible();

  await page.getByRole('link', { name: 'Settings' }).click();
  await signInToDrive(page);
  await page.getByRole('button', { name: 'Keep this vault here' }).click();
  const location = page.getByTestId('cloud-location');
  await expect(location).toHaveAttribute('data-state', 'google-drive');
  await expect(location).toContainText('Vault/Demo.pwv');
  await page.getByRole('link', { name: 'Back to the vault' }).click();
  await expect(page.getByTestId('cloud-status')).toHaveAttribute('data-state', 'synced');

  const second = await browser.newContext();
  await useFakeGoogle(second, drive);
  const other = await second.newPage();
  await other.goto('vault');
  await waitForApp(other);
  await other.getByRole('link', { name: 'Open from a cloud…' }).click();
  await signInToDrive(other);
  await other.getByRole('button', { name: 'Open', exact: true }).click();
  const password = other.getByLabel('Master password');
  await password.fill(DEMO_PASSWORD);
  await password.press('Enter');

  await expect(other.getByRole('option', { name: /GitHub/ })).toBeVisible();
  await expect(other.getByTestId('cloud-status')).toHaveAttribute('data-state', 'synced');
  expect(drive.paths('drive')).toEqual(['Vault', 'Vault/Demo.pwv']);
  await first.close();
  await second.close();
});
