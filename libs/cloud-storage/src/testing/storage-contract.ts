import { assert } from '@frozik/utils/assert/assert';

import { storagePath } from '../core/storage-path';
import type { IStorageProvider } from '../core/storage-provider';

const SIGNAL = new AbortController().signal;
const FILE = storagePath('Vault/main.pwv');
const EVERY_BYTE = Uint8Array.from({ length: 256 }, (_, index) => index);
const ONE_MIB = 1024 * 1024;

/**
 * One suite every provider passes: the same promises about
 * revisions, preconditions and errors, whatever stores the bytes.
 */
export function describeStorageProviderContract(
  name: string,
  create: () => IStorageProvider | Promise<IStorageProvider>
): void {
  describe(`${name} — storage provider contract`, () => {
    it('reports nothing where nothing was written', async () => {
      const provider = await create();

      expect(await provider.stat(FILE, SIGNAL)).toEqual({ ok: true, value: null });
      expect(await provider.read(FILE, SIGNAL)).toEqual({ ok: true, value: null });
    });

    it('creates only where nothing exists, and says what is there otherwise', async () => {
      const provider = await create();

      const created = await provider.write(FILE, EVERY_BYTE, { kind: 'absent' }, SIGNAL);
      const again = await provider.write(FILE, EVERY_BYTE, { kind: 'absent' }, SIGNAL);

      assert(created.ok && created.value.kind === 'ok');
      expect(again).toEqual({ ok: true, value: { kind: 'conflict', current: created.value.stat } });
    });

    it('reads back exactly the bytes and the revision it wrote', async () => {
      const provider = await create();
      const large = Uint8Array.from({ length: ONE_MIB }, (_, index) => (index * 7) % 256);

      const written = await provider.write(FILE, large, { kind: 'absent' }, SIGNAL);
      const read = await provider.read(FILE, SIGNAL);

      assert(written.ok && written.value.kind === 'ok' && read.ok && read.value !== null);
      expect(read.value.bytes).toEqual(large);
      expect(read.value.stat).toEqual(written.value.stat);
      expect(read.value.stat.size).toBe(ONE_MIB);
    });

    it('replaces only the revision the writer read, and gives every version a new revision', async () => {
      const provider = await create();
      const first = await provider.write(FILE, Uint8Array.of(1), { kind: 'absent' }, SIGNAL);
      assert(first.ok && first.value.kind === 'ok');
      const stale = first.value.stat.rev;

      const second = await provider.write(
        FILE,
        Uint8Array.of(2),
        { kind: 'match', rev: stale },
        SIGNAL
      );
      assert(second.ok && second.value.kind === 'ok');
      const lostUpdate = await provider.write(
        FILE,
        Uint8Array.of(3),
        { kind: 'match', rev: stale },
        SIGNAL
      );

      expect(second.value.stat.rev).not.toBe(stale);
      expect(lostUpdate).toEqual({
        ok: true,
        value: { kind: 'conflict', current: second.value.stat },
      });
      expect(await provider.read(FILE, SIGNAL)).toMatchObject({
        ok: true,
        value: { bytes: Uint8Array.of(2) },
      });
    });

    it('never reuses a revision, even for a file deleted and created again', async () => {
      const provider = await create();
      const first = await provider.write(FILE, Uint8Array.of(1), { kind: 'absent' }, SIGNAL);
      assert(first.ok && first.value.kind === 'ok');
      await provider.remove(FILE, { kind: 'match', rev: first.value.stat.rev }, SIGNAL);

      const recreated = await provider.write(FILE, Uint8Array.of(1), { kind: 'absent' }, SIGNAL);
      const replay = await provider.write(
        FILE,
        Uint8Array.of(9),
        { kind: 'match', rev: first.value.stat.rev },
        SIGNAL
      );

      assert(recreated.ok && recreated.value.kind === 'ok');
      expect(recreated.value.stat.rev).not.toBe(first.value.stat.rev);
      expect(replay.ok && replay.value.kind).toBe('conflict');
    });

    it('overwrites on an explicit request whatever is there', async () => {
      const provider = await create();
      await provider.write(FILE, Uint8Array.of(1), { kind: 'absent' }, SIGNAL);

      const overwritten = await provider.write(
        FILE,
        Uint8Array.of(7),
        { kind: 'overwrite' },
        SIGNAL
      );

      expect(overwritten.ok && overwritten.value.kind).toBe('ok');
    });

    it('removes only the revision it was told, and says when there is nothing to remove', async () => {
      const provider = await create();
      const written = await provider.write(FILE, Uint8Array.of(1), { kind: 'absent' }, SIGNAL);
      assert(written.ok && written.value.kind === 'ok');
      const other = await provider.write(FILE, Uint8Array.of(2), { kind: 'overwrite' }, SIGNAL);
      assert(other.ok && other.value.kind === 'ok');

      expect(
        await provider.remove(FILE, { kind: 'match', rev: written.value.stat.rev }, SIGNAL)
      ).toEqual({
        ok: true,
        value: { kind: 'conflict', current: other.value.stat },
      });
      expect(
        await provider.remove(FILE, { kind: 'match', rev: other.value.stat.rev }, SIGNAL)
      ).toEqual({ ok: true, value: { kind: 'removed' } });
      expect(await provider.remove(FILE, { kind: 'overwrite' }, SIGNAL)).toEqual({
        ok: false,
        error: { kind: 'not-found' },
      });
    });

    it('lists the files directly in a folder, in path order', async () => {
      const provider = await create();
      for (const path of ['Vault/b.pwv', 'Vault/a.pwv', 'Vault/old/c.pwv', 'Other/d.pwv']) {
        await provider.write(storagePath(path), Uint8Array.of(0), { kind: 'absent' }, SIGNAL);
      }

      const listed = await provider.list(storagePath('Vault'), SIGNAL);

      expect(listed.ok && listed.value.map(stat => stat.path)).toEqual([
        'Vault/a.pwv',
        'Vault/b.pwv',
      ]);
    });

    it('does nothing for an aborted call and says so', async () => {
      const provider = await create();
      const aborted = AbortSignal.abort();

      expect(await provider.write(FILE, Uint8Array.of(1), { kind: 'absent' }, aborted)).toEqual({
        ok: false,
        error: { kind: 'aborted' },
      });
      expect(await provider.stat(FILE, SIGNAL)).toEqual({ ok: true, value: null });
    });
  });
}
