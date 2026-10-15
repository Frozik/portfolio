import { FAKE_TOKEN } from '@frozik/cloud-storage/google-drive/fake-drive-server.test-helper';
import type { createFakeDriveServer } from '@frozik/cloud-storage/google-drive/fake-drive-server.test-helper';
import type { BrowserContext } from '@playwright/test';
import { isNil } from 'lodash-es';

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

/** Google's script and Drive's REST API answered from the test: one Drive every profile reaches. */
export async function routeFakeGoogle(
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
