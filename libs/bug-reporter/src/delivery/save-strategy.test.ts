import { afterEach, describe, expect, it, vi } from 'vitest';

import { createReportSink } from './save-strategy';

describe('createReportSink', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prefers the native save dialog when the browser has one', () => {
    vi.stubGlobal('showSaveFilePicker', vi.fn());
    expect(createReportSink({ streamSaverMitmUrl: '/mitm.html' }).strategy).toBe(
      'file-system-access'
    );
  });

  it('streams through StreamSaver when a service worker can run and a mitm page is configured', () => {
    vi.stubGlobal('showSaveFilePicker', undefined);
    vi.stubGlobal('isSecureContext', true);
    vi.stubGlobal('navigator', { ...navigator, serviceWorker: {} });
    expect(createReportSink({ streamSaverMitmUrl: '/mitm.html' }).strategy).toBe('stream-saver');
    expect(createReportSink({ streamSaverMitmUrl: null }).strategy).toBe('blob-download');
  });

  it('buffers into a download link anywhere else', () => {
    vi.stubGlobal('showSaveFilePicker', undefined);
    vi.stubGlobal('isSecureContext', false);
    expect(createReportSink({ streamSaverMitmUrl: '/mitm.html' }).strategy).toBe('blob-download');
  });
});

describe('report sink', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function archiveOf(...chunks: readonly number[][]): ReadableStream<Uint8Array> {
    return new ReadableStream({
      start(controller) {
        chunks.forEach(chunk => controller.enqueue(new Uint8Array(chunk)));
        controller.close();
      },
    });
  }

  it('pipes the archive into the chosen file and reports progress as bytes land', async () => {
    const written: Uint8Array[] = [];
    const writable = new WritableStream<Uint8Array>({ write: chunk => void written.push(chunk) });
    vi.stubGlobal(
      'showSaveFilePicker',
      vi.fn().mockResolvedValue({ createWritable: () => Promise.resolve(writable) })
    );
    const progress: number[] = [];

    const outcome = await createReportSink({ streamSaverMitmUrl: null }).save(
      'r.zip',
      archiveOf([1, 2], [3]),
      bytes => progress.push(bytes)
    );

    expect(outcome).toBe('saved');
    expect(written.map(chunk => [...chunk])).toEqual([[1, 2], [3]]);
    expect(progress).toEqual([2, 3]);
  });

  it('treats a dismissed dialog as a cancellation, not a failure', async () => {
    vi.stubGlobal(
      'showSaveFilePicker',
      vi.fn().mockRejectedValue(new DOMException('dismissed', 'AbortError'))
    );
    const outcome = await createReportSink({ streamSaverMitmUrl: null }).save(
      'r.zip',
      archiveOf([1]),
      () => undefined
    );
    expect(outcome).toBe('cancelled');
  });
});
