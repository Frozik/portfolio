// @vitest-environment node
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startCertWatcher } from './CertWatcher';

async function waitFor<T>(predicate: () => T | undefined, timeoutMs = 2_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = predicate();
    if (value !== undefined) {
      return value;
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error('waitFor: predicate never satisfied');
}

describe('CertWatcher', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'comm-cert-watcher-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('reload reads the current cert + key on demand', async () => {
    const certPath = join(dir, 'fullchain.pem');
    const keyPath = join(dir, 'privkey.pem');
    await writeFile(certPath, 'cert-v1');
    await writeFile(keyPath, 'key-v1');

    let received: { cert: string; key: string } | null = null;
    const watcher = startCertWatcher({
      certPath,
      keyPath,
      onReload: next => {
        received = { cert: next.cert.toString('utf8'), key: next.key.toString('utf8') };
      },
    });
    try {
      await watcher.reload();
      expect(received).toEqual({ cert: 'cert-v1', key: 'key-v1' });
    } finally {
      watcher.stop();
    }
  });

  // fs.watch is unreliable on CI runners (tmpfs / overlayfs often miss
  // change events). The read-pipeline + stop logic is covered by the
  // other tests in this suite; this one only verifies the inotify wiring
  // which is platform-dependent. Skip on CI to avoid flakes.
  it.skipIf(process.env.CI === 'true')(
    'fires onReload when the cert file changes on disk',
    async () => {
      const certPath = join(dir, 'fullchain.pem');
      const keyPath = join(dir, 'privkey.pem');
      await writeFile(certPath, 'cert-v1');
      await writeFile(keyPath, 'key-v1');

      const events: Array<{ cert: string; key: string }> = [];
      const watcher = startCertWatcher({
        certPath,
        keyPath,
        onReload: next => {
          events.push({ cert: next.cert.toString('utf8'), key: next.key.toString('utf8') });
        },
      });
      try {
        // Initial load via reload (mirrors how bootstrap will use it).
        await watcher.reload();
        expect(events.length).toBe(1);

        await writeFile(certPath, 'cert-v2');
        await writeFile(keyPath, 'key-v2');

        const last = await waitFor(() =>
          events.find(event => event.cert === 'cert-v2' && event.key === 'key-v2')
        );
        expect(last).toEqual({ cert: 'cert-v2', key: 'key-v2' });
      } finally {
        watcher.stop();
      }
    }
  );

  it('stop is idempotent and silences subsequent change events', async () => {
    const certPath = join(dir, 'fullchain.pem');
    const keyPath = join(dir, 'privkey.pem');
    await writeFile(certPath, 'cert-v1');
    await writeFile(keyPath, 'key-v1');

    let count = 0;
    const watcher = startCertWatcher({
      certPath,
      keyPath,
      onReload: () => {
        count += 1;
      },
    });
    await watcher.reload();
    expect(count).toBe(1);
    watcher.stop();
    watcher.stop();

    await writeFile(certPath, 'cert-v2');
    // Wait long enough that any straggling watcher event would have fired.
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(count).toBe(1);
  });

  it('reads the cert + key as Buffers (compatible with tls.SecureContext)', async () => {
    const certPath = join(dir, 'fullchain.pem');
    const keyPath = join(dir, 'privkey.pem');
    await writeFile(certPath, 'cert-bytes');
    await writeFile(keyPath, 'key-bytes');

    const received: Array<{ cert: Buffer; key: Buffer }> = [];
    const watcher = startCertWatcher({
      certPath,
      keyPath,
      onReload: next => {
        received.push(next);
      },
    });
    try {
      await watcher.reload();
      const last = received.at(-1);
      expect(last).toBeDefined();
      if (last !== undefined) {
        expect(Buffer.isBuffer(last.cert)).toBe(true);
        expect(Buffer.isBuffer(last.key)).toBe(true);
        // Sanity: the buffer matches what we wrote.
        const certCheck = await readFile(certPath);
        expect(last.cert.equals(certCheck)).toBe(true);
      }
    } finally {
      watcher.stop();
    }
  });
});
