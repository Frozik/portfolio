import { assert } from '@frozik/utils/assert/assert';
import { unpackContainer } from '@frozik/vault/format/container';
import {
  ASSET_MAX_BYTES,
  BLOB_MAX_BYTES,
  fileAssetIdsOf,
  ORPHAN_RETENTION_MS,
} from '@frozik/vault/model/asset-edits';
import { allFields } from '@frozik/vault/model/card';
import type { TAssetId } from '@frozik/vault/model/ids';
import { MS_PER_DAY } from '@frozik/vault/model/password-age';
import { DOCUMENT_TEMPLATE } from '@frozik/vault/model/templates/document';
import { isNil } from 'lodash-es';
import { when } from 'mobx';

import { CLOUD_PUSH_DEBOUNCE_MS } from '../../cloud/application/CloudLink';
import type { VaultSession } from '../../session/application/VaultSession';
import { LOCAL_COPY_PATH } from '../../sync/domain/local-copy';
import {
  aCloud,
  aDevice,
  linkedToWebDav,
  openedFromTheCloud,
  TEST_FOLDER,
  TEST_PASSWORD,
} from '../../testing/fake-device';
import { blobPathBeside } from './VaultFiles';

const BIG = ASSET_MAX_BYTES + 1;
const COPY_PASSWORD = 'a separate password for the copy';
const FILL = 7;
/** A random byte is the fill once in 256; plaintext would be it everywhere. */
const RANDOM_SHARE_BOUND = 128;

function aScan(size: number, fill = FILL) {
  return { name: 'passport.pdf', type: 'application/pdf', bytes: new Uint8Array(size).fill(fill) };
}

/** A document card with one file attached and saved; the file's asset id. */
async function savedWithFile(session: VaultSession, size: number): Promise<TAssetId> {
  session.editing.startCreating(DOCUMENT_TEMPLATE.id, key => key);
  const draft = session.editing.draft;
  const scans = isNil(draft)
    ? undefined
    : allFields(draft.card).find(field => field.spec.kind === 'file');
  assert(!isNil(draft) && !isNil(scans));
  expect(await draft.attachFiles(scans.id, [aScan(size)])).toEqual([]);
  const field = allFields(draft.card).find(candidate => candidate.id === scans.id);
  const [assetId] = isNil(field) ? [] : fileAssetIdsOf(field);
  assert(!isNil(assetId));
  draft.save();
  return assetId;
}

async function unlockedOn(device: ReturnType<typeof aDevice>) {
  const store = device.startStore();
  store.create('Home', TEST_PASSWORD);
  await when(() => store.session !== null);
  const { session } = store;
  assert(!isNil(session));
  return { store, session };
}

describe('files too big for the vault file', () => {
  it('are sealed beside it on this device, and the card shows them at once', async () => {
    const device = aDevice();
    const { session } = await unlockedOn(device);

    const assetId = await savedWithFile(session, BIG);

    expect(session.document.assets.get(assetId)?.storage.kind).toBe('blob');
    expect(session.document.assetBytes.has(assetId)).toBe(false);
    const sealed = await device
      .localCopyOf(session.vaultKey)
      .read(blobPathBeside(LOCAL_COPY_PATH, assetId), new AbortController().signal);
    const plainBytes = sealed.ok ? sealed.value?.bytes.filter(byte => byte === FILL).length : 0;
    expect(plainBytes).toBeLessThan(BIG / RANDOM_SHARE_BOUND);
    const shown = session.files.fileOf(assetId);
    expect(shown.kind === 'ready' && shown.bytes.byteLength).toBe(BIG);
  });

  it('are refused past the largest a blob may be', async () => {
    const { session } = await unlockedOn(aDevice());
    session.editing.startCreating(DOCUMENT_TEMPLATE.id, key => key);
    const draft = session.editing.draft;
    const scans = isNil(draft)
      ? undefined
      : allFields(draft.card).find(field => field.spec.kind === 'file');
    assert(!isNil(draft) && !isNil(scans));

    expect(await draft.attachFiles(scans.id, [aScan(BLOB_MAX_BYTES + 1)])).toEqual(['too-large']);
    expect(session.document.assets.size).toBe(0);
  });

  it('are read back from this device after the vault is locked and opened again', async () => {
    const device = aDevice();
    const { store, session } = await unlockedOn(device);
    const { vaultKey } = session;
    const assetId = await savedWithFile(session, BIG);
    await when(() => store.session?.local.state.phase.kind === 'idle');
    store.lock('manual');

    const again = device.startStore();
    await again.registry.refresh();
    again.choose(vaultKey);
    again.unlock(TEST_PASSWORD);
    await when(() => again.session !== null);
    const reopened = again.session;
    assert(!isNil(reopened));
    expect(reopened.files.fileOf(assetId).kind).toBe('idle');

    await reopened.files.request(assetId);
    const shown = reopened.files.fileOf(assetId);
    expect(shown.kind === 'ready' && shown.bytes.every(byte => byte === FILL)).toBe(true);
  });

  it('reach the cloud after a sync and open on another device from there', async () => {
    const cloud = aCloud();
    const first = await linkedToWebDav(aDevice({ cloud }));
    const session = first.store.session;
    assert(!isNil(session));
    const assetId = await savedWithFile(session, BIG);
    session.cloud.requestPush();
    first.device.time.advance(CLOUD_PUSH_DEBOUNCE_MS);
    const uploaded = blobPathBeside('Family.pwv', assetId);
    await vi.waitFor(async () => {
      const there = await cloud.storeAt(TEST_FOLDER)?.stat(uploaded, new AbortController().signal);
      expect(there?.ok && !isNil(there.value)).toBe(true);
    });

    const second = await openedFromTheCloud(aDevice({ cloud, seed: 9 }));
    const onSecond = second.session;
    assert(!isNil(onSecond));
    await onSecond.files.request(assetId);

    const shown = onSecond.files.fileOf(assetId);
    expect(shown.kind === 'ready' && shown.bytes.byteLength).toBe(BIG);
  });

  it('show as missing when neither this device nor the cloud has them', async () => {
    const device = aDevice();
    const { store, session } = await unlockedOn(device);
    const { vaultKey } = session;
    const assetId = await savedWithFile(session, BIG);
    await when(() => store.session?.local.state.phase.kind === 'idle');
    store.lock('manual');
    await device
      .localCopyOf(vaultKey)
      .remove(
        blobPathBeside(LOCAL_COPY_PATH, assetId),
        { kind: 'overwrite' },
        new AbortController().signal
      );

    const again = device.startStore();
    await again.registry.refresh();
    again.choose(vaultKey);
    again.unlock(TEST_PASSWORD);
    await when(() => again.session !== null);
    await again.session?.files.request(assetId);

    expect(again.session?.files.fileOf(assetId).kind).toBe('missing');
  });

  it('go into the open archive with the rest of the card', async () => {
    const device = aDevice();
    const { session } = await unlockedOn(device);
    const assetId = await savedWithFile(session, BIG);
    const exporting = session.flows.exportOf();
    exporting.setFormat('zip');
    exporting.setPassword(TEST_PASSWORD);
    exporting.setAcknowledged(true);

    await exporting.prepare();
    await exporting.save();

    const [archive] = device.saved;
    assert(!isNil(archive));
    const card = [...session.document.cards.values()].find(candidate =>
      allFields(candidate).some(field => fileAssetIdsOf(field).includes(assetId))
    );
    const entries = unpackContainer(archive.bytes);
    const entry = entries.ok
      ? entries.value.get(`cards/${card?.id}/files/passport.pdf`)
      : undefined;
    expect(entry?.byteLength).toBe(BIG);
  });

  it('leave this device once the vault no longer has them', async () => {
    const device = aDevice();
    const { store, session } = await unlockedOn(device);
    const { vaultKey } = session;
    const kept = await savedWithFile(session, BIG);
    const gone = await savedWithFile(session, BIG);
    session.apply(document => {
      const assets = new Map(document.assets);
      assets.delete(gone);
      return { ...document, assets };
    });
    await when(() => store.session?.local.state.phase.kind === 'idle');
    store.lock('manual');

    const again = device.startStore();
    await again.registry.refresh();
    again.choose(vaultKey);
    again.unlock(TEST_PASSWORD);
    await when(() => again.session !== null);

    const local = device.localCopyOf(vaultKey);
    const signal = new AbortController().signal;
    await vi.waitFor(async () => {
      const left = await local.read(blobPathBeside(LOCAL_COPY_PATH, gone), signal);
      expect(left.ok && left.value).toBeNull();
    });
    const stays = await local.stat(blobPathBeside(LOCAL_COPY_PATH, kept), signal);
    expect(stays.ok && !isNil(stays.value)).toBe(true);
  });

  it('are looked for again after the next sync when they had not reached the cloud yet', async () => {
    const cloud = aCloud();
    const first = await linkedToWebDav(aDevice({ cloud }));
    const session = first.store.session;
    assert(!isNil(session));
    const assetId = await savedWithFile(session, BIG);
    session.cloud.requestPush();
    first.device.time.advance(CLOUD_PUSH_DEBOUNCE_MS);
    const uploaded = blobPathBeside('Family.pwv', assetId);
    const signal = new AbortController().signal;
    const folder = cloud.storeAt(TEST_FOLDER);
    assert(!isNil(folder));
    await vi.waitFor(async () => {
      const there = await folder.read(uploaded, signal);
      expect(there.ok && !isNil(there.value)).toBe(true);
    });
    const sealed = await folder.read(uploaded, signal);
    assert(sealed.ok && !isNil(sealed.value));
    await folder.remove(uploaded, { kind: 'overwrite' }, signal);
    const secondDevice = aDevice({ cloud, seed: 9 });
    const second = await openedFromTheCloud(secondDevice);
    await second.session?.files.request(assetId);
    expect(second.session?.files.fileOf(assetId).kind).toBe('missing');

    await folder.write(uploaded, sealed.value.bytes, { kind: 'overwrite' }, signal);
    secondDevice.signals.setConcealed(true);
    secondDevice.signals.setConcealed(false);

    await when(() => second.session?.files.fileOf(assetId).kind === 'ready');
  });

  it('stay on this device when written after the copy this unlock opened: another tab may name them', async () => {
    const device = aDevice();
    const { store, session } = await unlockedOn(device);
    const { vaultKey } = session;
    await when(() => store.session?.local.state.phase.kind === 'idle');
    store.lock('manual');
    const signal = new AbortController().signal;
    const fresh = blobPathBeside(LOCAL_COPY_PATH, 'written-by-another-tab' as TAssetId);
    await device.localCopyOf(vaultKey).write(fresh, Uint8Array.of(1), { kind: 'absent' }, signal);

    const again = device.startStore();
    await again.registry.refresh();
    again.choose(vaultKey);
    again.unlock(TEST_PASSWORD);
    await when(() => again.session !== null);
    await again.session?.files.removeGone();

    const stays = await device.localCopyOf(vaultKey).stat(fresh, signal);
    expect(stays.ok && !isNil(stays.value)).toBe(true);
  });

  it('travel inside an encrypted copy and come out of its import as files of the other vault', async () => {
    const device = aDevice();
    const source = await unlockedOn(device);
    await savedWithFile(source.session, BIG);
    const exporting = source.session.flows.exportOf();
    exporting.setPassword(COPY_PASSWORD);
    exporting.setConfirmation(COPY_PASSWORD);
    await exporting.prepare();
    expect(exporting.step).toMatchObject({
      kind: 'ready',
      file: { mime: 'application/zip' },
      missingFiles: 0,
    });
    await exporting.save();
    const [copy] = device.saved;
    assert(!isNil(copy));
    expect(copy.name).toMatch(/\.pwv\.zip$/);

    const other = await unlockedOn(aDevice({ seed: 9 }));
    const flow = other.session.flows.importInto(key => key);
    await flow.choose(copy.bytes);
    flow.setVaultPassword(COPY_PASSWORD);
    await flow.openVaultFile();
    await flow.confirm();

    expect(flow.step).toMatchObject({ kind: 'done', outcome: { filesDropped: 0 } });
    const [arrived] = [...other.session.document.assets.values()];
    assert(!isNil(arrived));
    expect(arrived.storage.kind).toBe('blob');
    await other.session.files.request(arrived.id);
    const shown = other.session.files.fileOf(arrived.id);
    expect(shown.kind === 'ready' && shown.bytes.every(byte => byte === FILL)).toBe(true);
  });

  it('that no version names any more leave the cloud a month on; a young one stays', async () => {
    const cloud = aCloud();
    const first = await linkedToWebDav(aDevice({ cloud }));
    const folder = cloud.storeAt(TEST_FOLDER);
    assert(!isNil(folder));
    const signal = new AbortController().signal;
    const now = first.device.time.clock.now();
    const leftover = blobPathBeside('Family.pwv', 'left-over' as TAssetId);
    const young = blobPathBeside('Family.pwv', 'just-uploaded' as TAssetId);
    cloud.setWrittenAt(now - ORPHAN_RETENTION_MS - MS_PER_DAY);
    await folder.write(leftover, Uint8Array.of(1), { kind: 'absent' }, signal);
    cloud.setWrittenAt(now - MS_PER_DAY);
    await folder.write(young, Uint8Array.of(2), { kind: 'absent' }, signal);
    cloud.setWrittenAt(null);

    await openedFromTheCloud(aDevice({ cloud, seed: 9 }));

    await vi.waitFor(async () => {
      const gone = await folder.stat(leftover, signal);
      expect(gone.ok && gone.value).toBeNull();
    });
    const stays = await folder.stat(young, signal);
    expect(stays.ok && !isNil(stays.value)).toBe(true);
  });
});
