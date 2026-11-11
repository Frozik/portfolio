import { Stack } from 'expo-router';
import { fireEvent, act, screen, waitFor } from 'expo-router/testing-library';
import { when } from 'mobx';

import type { IVaultFile } from '@frozik/vault-app/cloud/domain/ports/vault-file-picker';
import { LOCAL_COPY_PATH } from '@frozik/vault-app/sync/domain/local-copy';
import { aDevice, TEST_PASSWORD } from '@frozik/vault-app/testing/fake-device';
import { SAFEINCLOUD_XML } from '@frozik/vault/testing/import-fixtures';
import { aSafeInCloudDb } from '@frozik/vault/testing/safeincloud-db-fixture';

import TakeIn from '../../app/import';
import NewVault from '../../app/new';
import { OPEN_VAULT_ROUTES } from '../testing/open-vault-routes';
import { renderApp } from '../testing/render-app';
import { unlockedVaultWith } from '../testing/unlocked-vault';
import { IncomingFiles } from './IncomingFiles';

const SAFEINCLOUD_PASSWORD = 'pässwörd';

const ROUTES = {
  ...OPEN_VAULT_ROUTES,
  _layout: () => (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <IncomingFiles />
    </>
  ),
  import: TakeIn,
  new: NewVault,
};

/** Another app handing files over, one at a time, as Android does. */
function anotherApp() {
  let deliver: ((file: IVaultFile) => void) | null = null;
  return {
    follow: (onFile: (file: IVaultFile) => void) => {
      deliver = onFile;
      return () => {
        deliver = null;
      };
    },
    hand: (file: IVaultFile) => act(() => deliver?.(file)),
  };
}

async function aVaultFile() {
  const maker = aDevice();
  const store = maker.startStore();
  store.create('Family', TEST_PASSWORD);
  await when(() => store.session !== null);
  const vaultKey = store.session?.vaultKey ?? '';
  const read = await maker
    .localCopyOf(vaultKey)
    .read(LOCAL_COPY_PATH, new AbortController().signal);
  const bytes = read.ok && read.value !== null ? read.value.bytes : new Uint8Array(0);
  return { vaultKey, file: { name: 'Family 2026-11-13 09-30.pwv', bytes } };
}

async function aSafeInCloudFile(): Promise<IVaultFile> {
  const bytes = await aSafeInCloudDb(SAFEINCLOUD_XML, SAFEINCLOUD_PASSWORD);
  return { name: 'SafeInCloud_2026-11-13.db', bytes: new Uint8Array(bytes) };
}

/** A vault "Family" on the phone, locked, and the app on its first screen. */
async function aLockedVault(followIncomingFiles: ReturnType<typeof anotherApp>['follow']) {
  const device = aDevice();
  const maker = device.startStore();
  maker.create('Family', TEST_PASSWORD);
  await when(() => maker.session !== null);
  const vaultKey = maker.session?.vaultKey ?? '';
  maker.lock('manual');
  const rendered = await renderApp(ROUTES, { device, followIncomingFiles });
  await act(() => rendered.app.registry.refresh());
  return { ...rendered, vaultKey };
}

async function importTheDatabase(): Promise<void> {
  await fireEvent.changeText(await screen.findByTestId('import-password'), SAFEINCLOUD_PASSWORD);
  await fireEvent.press(screen.getByTestId('import-open'));
  await fireEvent.press(await screen.findByTestId('import-confirm'));
  await screen.findByTestId('import-done');
}

function titlesIn(app: {
  readonly session: {
    readonly document: { readonly cards: ReadonlyMap<string, { readonly title: string }> };
  } | null;
}) {
  return [...(app.session?.document.cards.values() ?? [])].map(card => card.title).sort();
}

describe('a file another app hands over', () => {
  it('opens as a vault this phone now knows, at its unlock', async () => {
    const { vaultKey, file } = await aVaultFile();
    const other = anotherApp();
    const rendered = await renderApp(ROUTES, {
      device: aDevice({ seed: 9 }),
      followIncomingFiles: other.follow,
    });

    await other.hand(file);

    await waitFor(() => expect(rendered.getPathname()).toBe(`/${vaultKey}`));
    expect(rendered.app.registry.vaults.value?.map(vault => vault.vaultKey)).toEqual([vaultKey]);
  });

  it('asks which vault another manager’s database goes into, every vault of the phone offered', async () => {
    const other = anotherApp();
    const { getPathname } = await aLockedVault(other.follow);

    await other.hand(await aSafeInCloudFile());

    await waitFor(() => expect(getPathname()).toBe('/import'));
    expect(screen.getAllByTestId('take-in-vault')).toHaveLength(1);
    expect(screen.queryByTestId('take-in-vault-open')).toBeNull();
  });

  it('imports into a locked vault once it is picked and unlocked', async () => {
    const other = anotherApp();
    const { app, getPathname, vaultKey } = await aLockedVault(other.follow);

    await other.hand(await aSafeInCloudFile());
    await fireEvent.press(await screen.findByTestId('take-in-vault'));
    await fireEvent.changeText(await screen.findByTestId('unlock-password'), TEST_PASSWORD);
    await fireEvent.press(screen.getByTestId('unlock-submit'));
    await importTheDatabase();

    expect({ page: getPathname(), titles: titlesIn(app) }).toEqual({
      page: `/${vaultKey}/settings/data`,
      titles: ['Example mail', 'Travel card'],
    });
  });

  it('imports into a new vault when that is the choice, once the vault is made', async () => {
    const other = anotherApp();
    const { app, getPathname } = await aLockedVault(other.follow);

    await other.hand(await aSafeInCloudFile());
    await fireEvent.press(await screen.findByTestId('take-in-new'));
    await fireEvent.changeText(await screen.findByTestId('create-name'), 'Imported');
    await fireEvent.changeText(screen.getByTestId('create-password'), TEST_PASSWORD);
    await fireEvent.changeText(screen.getByTestId('create-confirmation'), TEST_PASSWORD);
    await fireEvent.press(screen.getByTestId('create-acknowledged'));
    await fireEvent.press(screen.getByTestId('create-submit'));
    await importTheDatabase();

    expect({
      page: getPathname(),
      vault: app.session?.document.settings.name,
      titles: titlesIn(app),
    }).toEqual({
      page: `/${app.session?.vaultKey}/settings/data`,
      vault: 'Imported',
      titles: ['Example mail', 'Travel card'],
    });
  });

  it('leaves the open vault alone when a new one is chosen, and goes to make it', async () => {
    const other = anotherApp();
    const { app, getPathname, vaultKey } = await unlockedVaultWith([], {
      followIncomingFiles: other.follow,
      routes: ROUTES,
    });

    await other.hand(await aSafeInCloudFile());
    await fireEvent.press(await screen.findByTestId('take-in-new'));
    await screen.findByTestId('create');

    expect({ page: getPathname(), open: app.session?.vaultKey ?? null }).toEqual({
      page: '/new',
      open: null,
    });
    expect(getPathname()).not.toBe(`/${vaultKey}/settings/data`);
  });

  it('imports into the open vault picked from the list, asking the database’s password', async () => {
    const other = anotherApp();
    const { app, getPathname, vaultKey } = await unlockedVaultWith([], {
      followIncomingFiles: other.follow,
      routes: ROUTES,
    });

    await other.hand(await aSafeInCloudFile());
    await waitFor(() => expect(getPathname()).toBe('/import'));
    expect(screen.getByTestId('take-in-vault-open')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('take-in-vault'));
    await importTheDatabase();

    expect({ page: getPathname(), titles: titlesIn(app) }).toEqual({
      page: `/${vaultKey}/settings/data`,
      titles: ['Example mail', 'Travel card'],
    });
  });

  it('leaves the database behind when the import is declined', async () => {
    const other = anotherApp();
    const { app, getPathname } = await unlockedVaultWith([], {
      followIncomingFiles: other.follow,
      routes: ROUTES,
    });

    await other.hand(await aSafeInCloudFile());
    await fireEvent.press(await screen.findByTestId('take-in-cancel'));

    await waitFor(() => expect(getPathname()).not.toBe('/import'));
    expect({ waiting: app.session === null ? null : titlesIn(app) }).toEqual({ waiting: [] });
  });
});
