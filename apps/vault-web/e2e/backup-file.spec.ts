import { readFile } from 'node:fs/promises';

import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { FIXTURE_CARDS } from './fixture-vault';
import { openFromDrive, unlock } from './open-vault';

async function dropFile(page: Page, file: { readonly name: string; readonly bytes: Buffer }) {
  const dataTransfer = await page.evaluateHandle(
    ({ name, bytes }) => {
      const transfer = new DataTransfer();
      transfer.items.add(new File([new Uint8Array(bytes)], name));
      return transfer;
    },
    { name: file.name, bytes: [...file.bytes] }
  );
  const zone = page.getByTestId('vault-drop');
  await zone.dispatchEvent('dragenter', { dataTransfer });
  await expect(zone).toHaveAttribute('data-state', 'over');
  await zone.dispatchEvent('drop', { dataTransfer });
}

test('a backup file saved in the settings brings the same vault back when dropped on another device', async ({
  browser,
  context,
}) => {
  await context.addInitScript(() => {
    Reflect.deleteProperty(window, 'showSaveFilePicker');
  });
  const page = await openFromDrive(context);
  await page.getByTestId('tab-settings').click();
  await page.getByTestId('backup-file-prepare').click();
  const downloading = page.waitForEvent('download');
  await page.getByTestId('backup-file-save').click();
  const download = await downloading;
  await expect(page.getByTestId('backup-file-saved')).toBeVisible();
  const path = await download.path();
  const backup = { name: download.suggestedFilename(), bytes: await readFile(path) };

  const otherDevice = await browser.newContext();
  const other = await otherDevice.newPage();
  await other.goto('/');
  await expect(other.getByTestId('no-vaults')).toBeVisible();
  await dropFile(other, backup);
  await unlock(other);

  await expect(other.getByTestId('card-row')).toHaveCount(FIXTURE_CARDS);
  await otherDevice.close();
});

test('a file that is no vault, chosen to open, is refused and lists nothing', async ({ page }) => {
  await page.goto('/');
  const choosing = page.waitForEvent('filechooser');
  await page.getByTestId('open-vault-file').click();
  const chooser = await choosing;
  await chooser.setFiles({
    name: 'notes.pwv',
    mimeType: 'text/plain',
    buffer: Buffer.from('notes'),
  });

  await expect(page.getByTestId('vault-file-failed')).toBeVisible();
  await expect(page.getByTestId('no-vaults')).toBeVisible();
});
