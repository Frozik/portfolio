import type { FileSinkOpening, FileSinkOptions } from './file-sink';

/**
 * StreamSaver.js: a service worker turns the stream into a download the
 * browser writes to disk as it arrives. `streamSaverMitmUrl` must point at a
 * same-origin copy of the library's `mitm.html` (with `sw.js` beside it); the
 * library is loaded on demand because the page may never need it.
 */
export async function openStreamSaverSink({
  name,
  streamSaverMitmUrl,
}: FileSinkOptions): Promise<FileSinkOpening> {
  if (streamSaverMitmUrl === null) {
    return { kind: 'unavailable' };
  }
  const streamSaver = await import('streamsaver');
  streamSaver.mitm = streamSaverMitmUrl;
  return {
    kind: 'opened',
    strategy: 'stream-saver',
    writable: streamSaver.createWriteStream(name),
  };
}
