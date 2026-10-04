import { describe, expect, it, vi } from 'vitest';

import { STREAM_SAVER_DIR, streamSaverAssets } from './stream-saver-assets.ts';

describe('streamSaverAssets', () => {
  it('emits StreamSaver’s page and worker into the build under their own directory', () => {
    const plugin = streamSaverAssets();
    const emitFile = vi.fn();
    const generateBundle = plugin.generateBundle;
    expect(typeof generateBundle).toBe('function');
    if (typeof generateBundle !== 'function') {
      return;
    }

    generateBundle.call({ emitFile } as never, {} as never, {}, false);

    const emitted = emitFile.mock.calls.map(
      ([asset]) => asset as { fileName: string; source: Buffer }
    );
    expect(emitted.map(asset => asset.fileName)).toEqual([
      `${STREAM_SAVER_DIR}/mitm.html`,
      `${STREAM_SAVER_DIR}/sw.js`,
    ]);
    expect(String(emitted[0]?.source)).toContain("navigator.serviceWorker.register('sw.js'");
  });
});
