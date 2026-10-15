import { expect, test } from '@playwright/test';

import { unlockedExtension } from './unlocked-extension';

const VERSION_MANIFEST = 'https://ciphra-vault.github.io/version.json';
const FAR_FUTURE = 'v999.0.0';

/** What the test reaches in the worker: the restart it holds back, the session's storage it reads. */
declare const chrome: {
  readonly runtime: object;
  readonly storage: { readonly session: { get(key: string): Promise<Record<string, unknown>> } };
};

test('a floor above this build locks the vault and says where the new one is', async () => {
  const { context, popup, worker } = await unlockedExtension();
  await context.route(VERSION_MANIFEST, route =>
    route.fulfill({
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        extension: {
          latest: FAR_FUTURE,
          minimum: FAR_FUTURE,
          zipUrl: 'https://example.test/x.zip',
        },
      }),
    })
  );
  // A full lock ends with the extension restarting, which an unpacked extension under test does
  // not survive; the restart is held back so the popup that asked for the lock can be read.
  await worker.evaluate(() => {
    Object.defineProperty(chrome.runtime, 'reload', { value: () => undefined });
  });

  await popup.reload();

  await expect(popup.getByTestId('update-notice')).toHaveAttribute('data-state', 'required');
  await expect(popup.getByTestId('unlock-submit')).toHaveCount(0);
  await expect
    .poll(() =>
      worker.evaluate(async () => Object.keys(await chrome.storage.session.get('session-key')))
    )
    .toEqual([]);
  await context.close();
});
