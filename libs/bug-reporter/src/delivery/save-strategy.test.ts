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
