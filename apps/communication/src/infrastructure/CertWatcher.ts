import { readFile, watch as watchPath } from 'node:fs/promises';
import { dirname } from 'node:path';

const RETRY_DELAY_MS = 100;
const RETRY_MAX_ATTEMPTS = 20;

type CertReloadCallback = (next: { cert: Buffer; key: Buffer }) => void;

export type CertWatcherParams = {
  certPath: string;
  keyPath: string;
  onReload: CertReloadCallback;
  /**
   * Called when a refresh attempt fails. Defaults to a no-op so a
   * transient ENOENT during certbot's atomic rename does not bubble up
   * as an unhandled rejection.
   */
  onError?: (error: unknown) => void;
};

export type CertWatcher = {
  /**
   * Force a reload now (used at boot to install the initial cert AND in
   * tests to deterministically wait for the callback).
   */
  reload(): Promise<void>;
  /**
   * Stop watching. Idempotent.
   */
  stop(): void;
};

/**
 * Watch a Let's Encrypt cert + key pair and call `onReload` whenever the
 * underlying files change. Built on `fs/promises.watch` (which uses inotify
 * on Linux) — no extra dependency beyond Node stdlib.
 *
 * certbot writes a new cert via the typical "tmp file + rename" dance, which
 * fires a `rename` event AND can briefly leave the path missing. We retry
 * the read a handful of times to absorb that window. ENOENT from outside
 * the rename window propagates to `onError`.
 */
export function startCertWatcher(params: CertWatcherParams): CertWatcher {
  const { certPath, keyPath, onReload } = params;
  const onError = params.onError ?? ((): void => undefined);

  const abortController = new AbortController();
  let stopped = false;

  async function readPair(): Promise<{ cert: Buffer; key: Buffer }> {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < RETRY_MAX_ATTEMPTS; attempt += 1) {
      try {
        const [cert, key] = await Promise.all([readFile(certPath), readFile(keyPath)]);
        return { cert, key };
      } catch (error) {
        lastError = error;
        // ENOENT during rename — wait briefly and retry. Anything else also
        // gets a retry, since fs operations on shared volumes can flake.
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
    throw lastError ?? new Error('cert read failed without specific error');
  }

  async function refresh(): Promise<void> {
    if (stopped) {
      return;
    }
    try {
      const next = await readPair();
      if (stopped) {
        return;
      }
      onReload(next);
    } catch (error) {
      onError(error);
    }
  }

  async function watchFile(targetPath: string): Promise<void> {
    // Watch the parent directory and filter on basename — atomic rename
    // replaces the inode, so a watcher attached directly to the file would
    // stop firing after the first rotation. This pattern is the one
    // certbot's own deploy hooks recommend.
    const parent = dirname(targetPath);
    try {
      // node:fs/promises.watch returns AsyncIterable<FileChangeInfo>.
      const changes = watchPath(parent, { signal: abortController.signal });
      for await (const change of changes) {
        if (stopped) {
          return;
        }
        // change.filename is the basename relative to `parent`.
        if (
          change.filename === undefined ||
          change.filename === null ||
          targetPath.endsWith(change.filename.toString())
        ) {
          await refresh();
        }
      }
    } catch (error) {
      if (stopped) {
        return;
      }
      // AbortError fires on stop — silence it. Any other error means the
      // watch itself failed (deleted dir, etc.); surface via onError.
      const code = (error as { name?: string; code?: string }).name;
      if (code === 'AbortError') {
        return;
      }
      onError(error);
    }
  }

  // Watch both files (one watcher per parent dir is enough when they share
  // a parent, but we don't assume that — Let's Encrypt uses
  // /etc/letsencrypt/live/<host>/ for both, but operators may symlink
  // elsewhere).
  void watchFile(certPath);
  if (dirname(certPath) !== dirname(keyPath)) {
    void watchFile(keyPath);
  }

  return {
    reload: refresh,
    stop(): void {
      if (stopped) {
        return;
      }
      stopped = true;
      abortController.abort();
    },
  };
}
