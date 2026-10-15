import { storagePath } from '@frozik/cloud-storage/core/storage-path';
import type { IStorageProvider } from '@frozik/cloud-storage/core/storage-provider';
import type { TDriveSpace } from '@frozik/cloud-storage/google-drive/drive-space';
import { createMemoryProvider } from '@frozik/cloud-storage/memory/memory-provider';
import { assert } from '@frozik/utils/assert/assert';
import type { Milliseconds } from '@frozik/utils/date/types';
import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';
import { createInThreadCodec } from '@frozik/vault/codec/in-thread-codec';
import { encodePassword } from '@frozik/vault/crypto/password-normalization';
import type { IVaultCard } from '@frozik/vault/model/card';
import { emptyVaultDocument } from '@frozik/vault/model/vault-document';
import { aCardWith, aField, anHlc } from '@frozik/vault/testing/builders';
import { createFakeKdf } from '@frozik/vault/testing/fake-kdf';
import { createSeededRandom } from '@frozik/vault/testing/seeded-random';
import { aManifest } from '@frozik/vault/testing/vault-file-fixtures';
import { isNil } from 'lodash-es';

import type { TCloudLink, IDriveSignInFailure } from '../domain/cloud';
import type { IExtensionServices, IFillRequest, ISessionKey, ISetup } from '../domain/ports';
import type { IQuickLockRecord } from '../domain/quick-unlock';
import { ExtensionSession, IDLE_LOCK_MS, PROTECTED_OPEN_MS } from './ExtensionSession';
import { handleRequest } from './handle-request';

const PASSWORD = 'correct horse battery staple';
const SIGNAL = new AbortController().signal;
const NOW = 1_760_000_000_000;
const HOST_RULE = { kind: 'url', match: 'host', useSharedCredentials: true } as const;
const ACCOUNT = 'jane@example.com';

function authRequired() {
  return Promise.resolve(err({ kind: 'auth-required' } as const));
}

/** Drive once Google's token is gone and cannot be renewed without a window. */
const SIGNED_OUT_DRIVE: IStorageProvider = {
  ...createMemoryProvider(),
  stat: authRequired,
  read: authRequired,
  list: authRequired,
};

function anAccount(url: string, details: Partial<IVaultCard> = {}): IVaultCard {
  return aCardWith(
    [
      aField(HOST_RULE, [url]),
      aField({ kind: 'login' }, 'jane'),
      aField({ kind: 'password', rotateEveryDays: null }, 's3cret', { sensitive: true }),
      aField({ kind: 'otp' }, 'otpauth://totp/GitHub:jane?secret=JBSWY3DPEHPK3PXP', {
        sensitive: true,
      }),
    ],
    { title: new URL(url).host, ...details }
  );
}

async function aVaultFile(cards: readonly IVaultCard[]) {
  const argon2 = createFakeKdf();
  const random = createSeededRandom(4);
  const codec = createInThreadCodec({ argon2, random, elapsed: () => 0 as Milliseconds });
  const keys = await codec.createKeys(encodePassword(PASSWORD), new AbortController().signal);
  assert(keys.ok);
  const document = {
    ...emptyVaultDocument('Family', anHlc(1)),
    cards: new Map(cards.map(card => [card.id, card])),
  };
  const sealed = await codec.seal(
    document,
    aManifest(),
    { ...keys.value, revision: 1, movedTo: null },
    new AbortController().signal
  );
  assert(sealed.ok);
  return { file: sealed.value, codec, argon2 };
}

/** One browser profile: its stores outlive any one service worker, as `storage.session` and IndexedDB do. */
function aBrowser() {
  const copies = new Map<string, ReturnType<typeof createMemoryProvider>>();
  let sessionKey: ISessionKey | null = null;
  let setup: ISetup | null = null;
  let quickLock: IQuickLockRecord | null = null;
  const lastMaster = new Map<string, Milliseconds>();
  const filled: { readonly tabId: number; readonly request: IFillRequest }[] = [];
  const copied: string[] = [];
  let reloads = 0;
  let alarm: number | null = null;
  let protectedUntil = 0;
  let syncing = false;
  let now = NOW;
  const folders = new Map<string, ReturnType<typeof createMemoryProvider>>();
  const sealed = new Map<string, Uint8Array<ArrayBuffer>>();
  let pendingLink: TCloudLink | null = null;
  const passwordsUsed: string[] = [];
  const drives = new Map<TDriveSpace, ReturnType<typeof createMemoryProvider>>();
  const drive = (space: TDriveSpace) => {
    const found = drives.get(space) ?? createMemoryProvider();
    drives.set(space, found);
    return found;
  };
  let signedIn = false;
  let signInAnswer: TResult<string | null, IDriveSignInFailure> = ok(ACCOUNT);
  const signInsFor: (string | null)[] = [];
  const services: IExtensionServices = {
    localCopyOf: vaultKey => {
      const copy = copies.get(vaultKey) ?? createMemoryProvider();
      copies.set(vaultKey, copy);
      return copy;
    },
    sessionKeys: {
      // Like `storage.session`, every read is a fresh copy the reader may zero.
      load: () =>
        Promise.resolve(
          isNil(sessionKey) ? null : { ...sessionKey, rawDek: sessionKey.rawDek.slice() }
        ),
      save: key => {
        sessionKey = { ...key, rawDek: key.rawDek.slice() };
        return Promise.resolve();
      },
      clear: () => {
        sessionKey = null;
        return Promise.resolve();
      },
    },
    setup: {
      load: () => Promise.resolve(setup),
      save: next => {
        setup = next;
        return Promise.resolve();
      },
      clear: () => {
        setup = null;
        return Promise.resolve();
      },
    },
    filler: {
      fill: (tabId, request) => {
        filled.push({ tabId, request });
        return Promise.resolve('filled');
      },
    },
    clipboard: {
      copy: text => {
        copied.push(text);
        return Promise.resolve(true);
      },
      clearPending: () => {
        copied.push('(cleared)');
        return Promise.resolve();
      },
    },
    protectedWindow: {
      load: () => Promise.resolve(protectedUntil),
      save: until => {
        protectedUntil = until;
        return Promise.resolve();
      },
    },
    restart: {
      reload: () => {
        reloads += 1;
        quickLock = null;
      },
    },
    quickLocks: {
      load: () => Promise.resolve(quickLock),
      save: record => {
        quickLock = record;
        return Promise.resolve();
      },
      clear: () => {
        quickLock = null;
        return Promise.resolve();
      },
    },
    lastMaster: {
      load: vaultKey => Promise.resolve(lastMaster.get(vaultKey) ?? null),
      save: (vaultKey, at) => {
        lastMaster.set(vaultKey, at);
        return Promise.resolve();
      },
    },
    quickExpiry: { set: () => Promise.resolve(), cancel: () => Promise.resolve() },
    idleAlarm: {
      set: delayMs => {
        alarm = delayMs;
        return Promise.resolve();
      },
      cancel: () => {
        alarm = null;
        return Promise.resolve();
      },
    },
    openWebDav: (source, password) => {
      passwordsUsed.push(password);
      const folder = folders.get(source.folderUrl) ?? createMemoryProvider();
      folders.set(source.folderUrl, folder);
      return folder;
    },
    deviceConfig: {
      get: (vaultKey, key) => Promise.resolve(ok(sealed.get(`${vaultKey}/${key}`) ?? null)),
      put: (vaultKey, key, bytes) => {
        sealed.set(`${vaultKey}/${key}`, bytes);
        return Promise.resolve(ok(undefined));
      },
      delete: (vaultKey, key) => {
        sealed.delete(`${vaultKey}/${key}`);
        return Promise.resolve(ok(undefined));
      },
      keys: () => Promise.resolve(ok([...sealed.keys()])),
    },
    googleDrive: {
      signIn: (_space, account) => {
        signInsFor.push(account);
        signedIn = signInAnswer.ok;
        return Promise.resolve(signInAnswer);
      },
      open: space => (signedIn ? drive(space) : SIGNED_OUT_DRIVE),
      signOut: () => {
        signedIn = false;
        return Promise.resolve();
      },
    },
    pendingLink: {
      load: () => Promise.resolve(pendingLink),
      save: link => {
        pendingLink = link;
        return Promise.resolve();
      },
      clear: () => {
        pendingLink = null;
        return Promise.resolve();
      },
    },
    syncAlarm: {
      start: () => {
        syncing = true;
        return Promise.resolve();
      },
      stop: () => {
        syncing = false;
        return Promise.resolve();
      },
    },
    random: createSeededRandom(5),
    now: () => now,
  };
  return {
    services,
    filled,
    copied,
    reloads: () => reloads,
    alarm: () => alarm,
    hasSessionKey: () => sessionKey !== null,
    syncing: () => syncing,
    copyOf: (vaultKey: string) => copies.get(vaultKey),
    sealedRecords: () => [...sealed.keys()],
    signedIn: () => signedIn,
    pendingLink: () => pendingLink,
    setup: () => setup,
    passwordsUsed,
    drive,
    signInsFor,
    signOut: () => {
      signedIn = false;
    },
    answerSignIn: (answer: TResult<string | null, IDriveSignInFailure>) => {
      signInAnswer = answer;
    },
    folder: (url: string) => {
      const folder = folders.get(url) ?? createMemoryProvider();
      folders.set(url, folder);
      return folder;
    },
    advance: (ms: number) => {
      now += ms;
    },
  };
}

async function unlockedWith(cards: readonly IVaultCard[]) {
  const browser = aBrowser();
  const { file, codec, argon2 } = await aVaultFile(cards);
  const worker = () => new ExtensionSession(browser.services, codec, argon2);
  const session = worker();
  expect(await session.openFile(file, 'Family.pwv')).toBe(true);
  expect(await session.unlock(PASSWORD)).toBeNull();
  return { browser, session, worker };
}

describe('the extension’s session', () => {
  it('is set up from a vault file, unlocked with its password, and refuses a wrong one', async () => {
    const browser = aBrowser();
    const { file, codec, argon2 } = await aVaultFile([]);
    const session = new ExtensionSession(browser.services, codec, argon2);
    expect(await session.status()).toEqual({ kind: 'not-set-up' });

    await session.openFile(file, 'Family.pwv');
    expect(await session.status()).toEqual({ kind: 'locked', vaultName: 'Family' });
    expect(await session.unlock('wrong')).toBe('wrong-password');
    expect(await session.unlock(PASSWORD)).toBeNull();

    expect(await session.status()).toEqual({
      kind: 'unlocked',
      vaultName: 'Family',
      quickUnlock: false,
      reminderDue: false,
    });
    expect(browser.alarm()).toBe(IDLE_LOCK_MS);
  });

  it('stays unlocked for a worker woken later, and locks for every worker once locked', async () => {
    const { browser, session, worker } = await unlockedWith([anAccount('https://github.com')]);

    expect(await worker().status()).toMatchObject({ kind: 'unlocked' });
    await session.lock();

    expect(browser.hasSessionKey()).toBe(false);
    expect(browser.reloads()).toBe(1);
    expect(await worker().status()).toMatchObject({ kind: 'locked' });
  });

  it('forgets its vault on reset — the copy, its cloud link, the Google sign-in — and takes another', async () => {
    const browser = aBrowser();
    const { file, codec, argon2 } = await aVaultFile([anAccount('https://github.com')]);
    const { file: other } = await aVaultFile([]);
    await browser
      .drive('my-drive')
      .write(storagePath('Vault/Family.pwv'), file, { kind: 'overwrite' }, SIGNAL);
    const worker = () => new ExtensionSession(browser.services, codec, argon2);
    const session = worker();
    await session.findDriveVaults('my-drive', 'Vault');
    await session.connectDrive({ space: 'my-drive', path: 'Vault/Family.pwv', account: ACCOUNT });
    await session.unlock(PASSWORD);
    const vaultKey = browser.setup()?.vaultKey;
    assert(!isNil(vaultKey));
    expect(browser.sealedRecords()).not.toEqual([]);

    await session.reset();

    expect(await worker().status()).toEqual({ kind: 'not-set-up' });
    expect(browser.hasSessionKey()).toBe(false);
    expect(browser.syncing()).toBe(false);
    expect(browser.reloads()).toBe(1);
    expect(browser.signedIn()).toBe(false);
    expect(browser.sealedRecords()).toEqual([]);
    expect(await browser.copyOf(vaultKey)?.stat(storagePath('vault.pwv'), SIGNAL)).toEqual({
      ok: true,
      value: null,
    });
    expect(
      await browser.drive('my-drive').stat(storagePath('Vault/Family.pwv'), SIGNAL)
    ).toMatchObject({
      ok: true,
      value: { path: 'Vault/Family.pwv' },
    });
    expect(await worker().openFile(other, 'Work.pwv')).toBe(true);
    expect(await worker().status()).toEqual({ kind: 'locked', vaultName: 'Work' });
  });

  it('can be reset while locked, its password forgotten', async () => {
    const { browser, session, worker } = await unlockedWith([]);
    await session.lock();

    await worker().reset();

    expect(await worker().status()).toEqual({ kind: 'not-set-up' });
    expect(browser.setup()).toBeNull();
  });

  it('offers the cards of the page by their addresses, never one of another site or subdomain', async () => {
    const github = anAccount('https://github.com');
    const accounts = anAccount('https://accounts.example.com');
    const { session } = await unlockedWith([github, accounts]);

    expect(
      (await session.cards.pageCards('https://github.com/login')).map(card => card.id)
    ).toEqual([github.id]);
    expect(await session.cards.pageCards('https://evil.example.com/login')).toEqual([]);
    expect(await session.cards.pageCards('https://github.com.evil.net/login')).toEqual([]);
  });

  it('fills login, password and the current code on the card’s site, and refuses any other', async () => {
    const github = anAccount('https://github.com');
    const { browser, session } = await unlockedWith([github]);

    expect(await session.cards.fill(github.id, 7, 'https://github.com/login', false)).toBe(
      'filled'
    );
    expect(await session.cards.fill(github.id, 7, 'https://gist.github.com/login', false)).toBe(
      'other-site'
    );

    const [first] = browser.filled;
    assert(first !== undefined);
    expect(first.tabId).toBe(7);
    expect(first.request).toMatchObject({ username: 'jane', password: 's3cret' });
    expect(first.request.otp).toMatch(/^\d{6}$/);
    expect(first.request.addresses).toEqual([{ stored: 'https://github.com', spec: HOST_RULE }]);
  });

  it('keeps a protected card’s secrets in the worker until the master password is typed again', async () => {
    const bank = anAccount('https://bank.example', { protected: true });
    const { browser, session } = await unlockedWith([bank]);
    const view = await session.cards.card(bank.id);
    const password = view?.fields.find(field => field.kind === 'password');
    assert(password !== undefined);

    expect(password.value).toBeNull();
    expect(await session.cards.reveal(bank.id, password.id)).toBeNull();
    expect(await session.cards.fill(bank.id, 1, 'https://bank.example/', false)).toBe(
      'not-allowed'
    );
    expect(await session.openProtected('wrong')).toBe('wrong-password');
    expect(await session.openProtected(PASSWORD)).toBeNull();
    expect(await session.cards.copy(bank.id, password.id)).toBe(true);
    browser.advance(PROTECTED_OPEN_MS);

    expect(await session.cards.reveal(bank.id, password.id)).toBeNull();
    expect(browser.copied).toEqual(['s3cret']);
  });

  it('reads its copy from a WebDAV folder, seals where it is at unlock, and pulls a newer file', async () => {
    const browser = aBrowser();
    const github = anAccount('https://github.com');
    const first = await aVaultFile([github]);
    const source = {
      folderUrl: 'https://dav.example.org/Vault/',
      username: 'jane',
      fileName: 'Family.pwv',
    };
    const folder = browser.folder(source.folderUrl);
    await folder.write(storagePath(source.fileName), first.file, { kind: 'overwrite' }, SIGNAL);
    const session = new ExtensionSession(browser.services, first.codec, first.argon2);

    expect(await session.connectWebDav(source, 'app-password')).toBe('connected');
    expect(await session.status()).toEqual({ kind: 'locked', vaultName: 'Family' });
    expect(JSON.stringify(browser.setup())).not.toContain('dav.example.org');
    expect(JSON.stringify(browser.setup())).not.toContain('jane');
    expect(await session.unlock(PASSWORD)).toBeNull();
    expect(browser.pendingLink()).toBeNull();
    expect(browser.syncing()).toBe(true);
    expect(await session.sync()).toBe('unchanged');

    const bank = anAccount('https://bank.example');
    const reopened = await first.codec.open(
      first.file,
      { kind: 'password', password: encodePassword(PASSWORD) },
      SIGNAL
    );
    assert(reopened.ok);
    const newer = await first.codec.seal(
      {
        ...reopened.value.document,
        cards: new Map([
          [github.id, github],
          [bank.id, bank],
        ]),
      },
      aManifest(),
      { ...reopened.value.keys, revision: 2, movedTo: null },
      SIGNAL
    );
    assert(newer.ok);
    await folder.write(storagePath(source.fileName), newer.value, { kind: 'overwrite' }, SIGNAL);

    expect(await session.sync()).toBe('updated');
    expect((await session.cards.pageCards('https://bank.example/')).map(card => card.id)).toEqual([
      bank.id,
    ]);
    expect(browser.passwordsUsed.every(password => password === 'app-password')).toBe(true);
  });

  it('locks when the cloud file comes under another key: the vault was rotated elsewhere', async () => {
    const browser = aBrowser();
    const first = await aVaultFile([anAccount('https://github.com')]);
    const source = {
      folderUrl: 'https://dav.example.org/Vault/',
      username: 'jane',
      fileName: 'Family.pwv',
    };
    const folder = browser.folder(source.folderUrl);
    await folder.write(storagePath(source.fileName), first.file, { kind: 'overwrite' }, SIGNAL);
    const session = new ExtensionSession(browser.services, first.codec, first.argon2);
    await session.connectWebDav(source, 'app-password');
    await session.unlock(PASSWORD);

    const reopened = await first.codec.open(
      first.file,
      { kind: 'password', password: encodePassword(PASSWORD) },
      SIGNAL
    );
    assert(reopened.ok);
    const rotatedKeys = await first.codec.rotateKey(
      reopened.value.keys,
      encodePassword(PASSWORD),
      SIGNAL
    );
    assert(rotatedKeys.ok);
    const rotated = await first.codec.seal(
      reopened.value.document,
      aManifest(),
      { ...rotatedKeys.value, revision: 2, movedTo: null },
      SIGNAL
    );
    assert(rotated.ok);
    await folder.write(storagePath(source.fileName), rotated.value, { kind: 'overwrite' }, SIGNAL);

    expect(await session.sync()).toBe('rotated');
    expect(browser.pendingLink()?.source).toEqual(source);
    expect(browser.hasSessionKey()).toBe(false);
    expect(browser.reloads()).toBe(1);
  });

  it('finds the vaults in a Drive folder after Google’s sign-in and keeps the account only sealed', async () => {
    const browser = aBrowser();
    const { file, codec, argon2 } = await aVaultFile([anAccount('https://github.com')]);
    const myDrive = browser.drive('my-drive');
    await myDrive.write(storagePath('Vault/Family.pwv'), file, { kind: 'overwrite' }, SIGNAL);
    await myDrive.write(storagePath('Vault/notes.txt'), file, { kind: 'overwrite' }, SIGNAL);
    const session = new ExtensionSession(browser.services, codec, argon2);

    const found = await session.findDriveVaults('my-drive', ' Vault/ ');
    expect(found).toEqual({
      kind: 'found',
      space: 'my-drive',
      account: ACCOUNT,
      paths: ['Vault/Family.pwv'],
    });
    expect(
      await session.connectDrive({ space: 'my-drive', path: 'Vault/Family.pwv', account: ACCOUNT })
    ).toBe('connected');
    expect(await session.status()).toEqual({ kind: 'locked', vaultName: 'Family' });
    expect(JSON.stringify(browser.setup())).not.toContain(ACCOUNT);
    expect(await session.unlock(PASSWORD)).toBeNull();

    expect(browser.pendingLink()).toBeNull();
    expect(await session.sync()).toBe('unchanged');
  });

  it('says Google’s sign-in is needed when the token cannot be renewed unseen, and pulls once signed in again', async () => {
    const browser = aBrowser();
    const { file, codec, argon2 } = await aVaultFile([]);
    await browser
      .drive('app-data')
      .write(storagePath('Vault/Family.pwv'), file, { kind: 'overwrite' }, SIGNAL);
    const session = new ExtensionSession(browser.services, codec, argon2);
    await session.findDriveVaults('app-data', '');
    await session.connectDrive({ space: 'app-data', path: 'Vault/Family.pwv', account: ACCOUNT });
    await session.unlock(PASSWORD);

    browser.signOut();
    expect(await session.sync()).toBe('signed-out');
    expect(await session.signInToDrive()).toBe('unchanged');

    expect(browser.signInsFor).toEqual([null, ACCOUNT]);
  });

  it('finds nothing when Google’s sign-in is closed unfinished', async () => {
    const browser = aBrowser();
    const { codec, argon2 } = await aVaultFile([]);
    browser.answerSignIn(err({ kind: 'cancelled', detail: 'The user did not approve access.' }));
    const session = new ExtensionSession(browser.services, codec, argon2);

    expect(await session.findDriveVaults('my-drive', 'Vault')).toEqual({
      kind: 'failed',
      reason: 'cancelled',
      detail: 'The user did not approve access.',
    });
  });

  it('clears a copied secret before the lock reloads the extension, which would cancel the clearing', async () => {
    const github = anAccount('https://github.com');
    const { browser, session } = await unlockedWith([github]);
    const login = (await session.cards.card(github.id))?.fields.find(
      field => field.kind === 'login'
    );
    assert(login !== undefined);

    await session.cards.copy(github.id, login.id);
    await session.lock();

    expect(browser.copied).toEqual(['jane', '(cleared)']);
  });

  it('keeps a protected card open for a worker woken later, until the window ends', async () => {
    const bank = anAccount('https://bank.example', { protected: true });
    const { session, worker } = await unlockedWith([bank]);
    const password = (await session.cards.card(bank.id))?.fields.find(
      field => field.kind === 'password'
    );
    assert(password !== undefined);
    await session.openProtected(PASSWORD);

    expect(await worker().cards.reveal(bank.id, password.id)).toBe('s3cret');
  });

  it('keeps no key when the file opens its key slot but not its contents', async () => {
    const browser = aBrowser();
    const { file, codec, argon2 } = await aVaultFile([]);
    const damaged = file.slice();
    damaged[damaged.length - 1] = (damaged[damaged.length - 1] ?? 0) ^ 0xff;
    const session = new ExtensionSession(browser.services, codec, argon2);
    await session.openFile(damaged, 'Family.pwv');

    expect(await session.unlock(PASSWORD)).toBe('corrupted');
    expect(browser.hasSessionKey()).toBe(false);
  });

  it('turns the idle lock into a PIN’s one try once a PIN is set up', async () => {
    const { session, worker } = await unlockedWith([]);
    expect(await session.setUpQuickUnlock(PASSWORD, '2468')).toBe(true);
    expect(await session.status()).toMatchObject({ kind: 'unlocked', quickUnlock: true });

    await session.lockQuickly();
    const locked = await worker().status();
    const opened = await worker().quickUnlock('2468');

    expect(locked).toEqual({ kind: 'quick-locked', vaultName: 'Family', digits: 4 });
    expect(opened).toBe('opened');
    expect(await worker().status()).toMatchObject({ kind: 'unlocked' });
  });

  it('leaves only the master password after a wrong PIN', async () => {
    const { session, worker } = await unlockedWith([]);
    await session.setUpQuickUnlock(PASSWORD, '2468');
    await session.lockQuickly();

    expect(await worker().quickUnlock('1111')).toBe('wrong-pin');
    expect(await worker().quickUnlock('2468')).toBe('wrong-pin');
    expect(await worker().status()).toEqual({ kind: 'locked', vaultName: 'Family' });
  });

  it('locks fully at the idle lock without a PIN, and refuses a PIN under a wrong password', async () => {
    const { session, browser } = await unlockedWith([]);

    expect(await session.setUpQuickUnlock('not it', '2468')).toBe(false);
    await session.lockQuickly();

    expect(browser.reloads()).toBe(1);
  });

  it('keeps the PIN after the lock button and leaves only the master password after locking completely', async () => {
    const { session, worker } = await unlockedWith([]);
    await session.setUpQuickUnlock(PASSWORD, '2468');

    await handleRequest(session, { kind: 'lock' });
    const afterButton = await worker().status();
    await worker().quickUnlock('2468');
    await handleRequest(worker(), { kind: 'lock-completely' });

    const afterComplete = await session.status();

    expect(afterButton).toEqual({ kind: 'quick-locked', vaultName: 'Family', digits: 4 });
    expect(afterComplete).toEqual({ kind: 'locked', vaultName: 'Family' });
  });
});
