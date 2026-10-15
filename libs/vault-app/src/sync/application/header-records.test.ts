import { storagePath } from '@frozik/cloud-storage/core/storage-path';
import { assert } from '@frozik/utils/assert/assert';
import { HASH_WASM_KDF } from '@frozik/vault/crypto/adapters/kdf-hash-wasm';
import { utf8 } from '@frozik/vault/crypto/bytes';
import { decodeHeader } from '@frozik/vault/format/header';
import { openVaultFile } from '@frozik/vault/format/open-vault';
import { sealVaultFile } from '@frozik/vault/format/seal-vault';
import { createSeededRandom } from '@frozik/vault/testing/seeded-random';
import { when } from 'mobx';

import { CLOUD_PUSH_DEBOUNCE_MS } from '../../cloud/application/CloudLink';
import { linkedToWebDav, TEST_FOLDER } from '../../testing/fake-device';

const SIGNAL = new AbortController().signal;
const FILE = storagePath('Family.pwv');
const NEWER_RECORD = { type: 0x7e, skippable: true, value: utf8('from a newer client') };

describe('header records of a newer format version', () => {
  it('are written back by this client after it took the file in, edited and synced', async () => {
    const { device, store } = await linkedToWebDav();
    const folder = device.cloud.storeAt(TEST_FOLDER);
    assert(folder !== undefined && store.session !== null);
    const keys = store.session.keys.current;
    const read = await folder.read(FILE, SIGNAL);
    assert(read.ok && read.value !== null);
    const opened = await openVaultFile(
      read.value.bytes,
      { kind: 'session', dek: keys.dek, keyId: keys.keyId },
      HASH_WASM_KDF
    );
    assert(opened.ok);
    const newer = await sealVaultFile(
      {
        manifest: opened.value.manifest,
        entries: [...opened.value.entries].map(([path, bytes]) => ({
          path,
          bytes,
          compress: true,
        })),
      },
      {
        ...opened.value.keys,
        revision: opened.value.header.revision + 1,
        movedTo: null,
        preserved: [NEWER_RECORD],
      },
      createSeededRandom(5)
    );
    await folder.write(FILE, newer, { kind: 'match', rev: read.value.stat.rev }, SIGNAL);
    device.signals.setConcealed(true);
    device.signals.setConcealed(false);
    await when(() => store.session?.cloud.status.kind === 'synced');

    store.session.apply(document => ({
      ...document,
      settings: { ...document.settings, name: 'Family & friends' },
    }));
    store.session.cloud.requestPush();
    device.time.advance(CLOUD_PUSH_DEBOUNCE_MS);
    await when(() => store.session?.cloud.status.kind === 'synced');
    const written = await folder.read(FILE, SIGNAL);
    assert(written.ok && written.value !== null);
    const header = decodeHeader(written.value.bytes);
    assert(header.ok);

    expect(header.value.header.revision).toBeGreaterThan(opened.value.header.revision + 1);
    expect(header.value.header.preserved).toEqual([NEWER_RECORD]);
  });
});
