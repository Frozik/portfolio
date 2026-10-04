import { fileSinkStrategy, openFileSink } from './open-file-sink';

const OPTIONS = {
  name: 'echo.bin',
  type: { description: 'Binary', mime: 'application/octet-stream', extension: '.bin' },
  streamSaverMitmUrl: '/mitm.html',
  allowBuffered: false,
} as const;

describe('file sink', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('prefers the native save dialog when the browser has one', () => {
    vi.stubGlobal('showSaveFilePicker', vi.fn());
    expect(fileSinkStrategy(OPTIONS)).toBe('file-system-access');
  });

  it('streams through StreamSaver when a service worker can run and a mitm page is configured', () => {
    vi.stubGlobal('showSaveFilePicker', undefined);
    vi.stubGlobal('isSecureContext', true);
    vi.stubGlobal('navigator', { ...navigator, serviceWorker: {} });
    expect(fileSinkStrategy(OPTIONS)).toBe('stream-saver');
    expect(fileSinkStrategy({ ...OPTIONS, streamSaverMitmUrl: null, allowBuffered: true })).toBe(
      'blob-download'
    );
  });

  it('offers the buffered download only to callers that accept buffering', async () => {
    vi.stubGlobal('showSaveFilePicker', undefined);
    vi.stubGlobal('isSecureContext', false);
    expect(fileSinkStrategy({ ...OPTIONS, allowBuffered: true })).toBe('blob-download');
    expect(await openFileSink(OPTIONS)).toEqual({ kind: 'unavailable' });
  });

  it('opens the chosen file before anything is written to it', async () => {
    const writable = new WritableStream<Uint8Array>();
    const picker = vi.fn().mockResolvedValue({ createWritable: () => Promise.resolve(writable) });
    vi.stubGlobal('showSaveFilePicker', picker);

    const opening = await openFileSink(OPTIONS);

    expect(opening).toEqual({ kind: 'opened', strategy: 'file-system-access', writable });
    expect(picker).toHaveBeenCalledWith({
      suggestedName: 'echo.bin',
      types: [{ description: 'Binary', accept: { 'application/octet-stream': ['.bin'] } }],
    });
  });

  it('treats a dismissed dialog as a cancellation, not a failure', async () => {
    vi.stubGlobal(
      'showSaveFilePicker',
      vi.fn().mockRejectedValue(new DOMException('dismissed', 'AbortError'))
    );
    expect(await openFileSink(OPTIONS)).toEqual({ kind: 'cancelled' });
  });
});
