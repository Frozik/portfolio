import type { TransportProtocol } from '../domain/connection';
import type { EchoLimits } from '../domain/echo';
import type { IClock } from '../domain/ports/clock';
import type { EchoOutcome, EchoRequest, IFileEcho } from '../domain/ports/file-echo';
import type { FileSinkOpener } from '../domain/ports/file-sink-opener';
import { EchoModel } from './EchoModel';

const LIMITS: EchoLimits = {
  maxFileBytes: 1000,
  bytesPerHour: 10_000,
  rateBytesPerSecond: 1e6,
  maxChunkBytes: 4,
};
const CLOCK: IClock = { now: () => 0, every: () => () => undefined };
const ON_HTTP3 = () => 'http3' as const;

/** An echo that answers with the given tally and summary without touching the network. */
function fileEchoAnswering(
  outcome: (request: EchoRequest) => EchoOutcome | Promise<EchoOutcome>
): IFileEcho {
  return {
    limits: () => Promise.resolve(LIMITS),
    echo: async request => outcome(request),
  };
}

function intact({ source }: EchoRequest): EchoOutcome {
  const size = source.size;
  return {
    summary: { bytes: size, crc32: 7, maxBufferedBytes: 4 },
    tally: {
      declaredBytes: size,
      sentBytes: size,
      sentCrc32: 7,
      receivedBytes: size,
      receivedCrc32: 7,
    },
  };
}

const OPENED: FileSinkOpener = () =>
  Promise.resolve({
    kind: 'opened',
    strategy: 'file-system-access',
    writable: new WritableStream(),
  });

function modelWith(
  fileEcho: IFileEcho,
  openSink: FileSinkOpener = OPENED,
  currentProtocol: () => TransportProtocol | undefined = ON_HTTP3
): EchoModel {
  return new EchoModel({ fileEcho, openSink, clock: CLOCK, currentProtocol });
}

async function ready(model: EchoModel, file: File): Promise<void> {
  await model.loadLimits(new AbortController().signal);
  model.select(file);
}

describe('echo model', () => {
  it('hands the file and the opened destination to the echo, chunked as the server allows', async () => {
    const echo = vi.fn(intact);
    const model = modelWith(fileEchoAnswering(echo));
    const file = new File([Uint8Array.of(1, 2, 3)], 'a.bin');
    await ready(model, file);

    await model.start();

    expect(echo).toHaveBeenCalledWith(
      expect.objectContaining({ source: file, maxChunkBytes: LIMITS.maxChunkBytes })
    );
    expect(model.results).toEqual([
      expect.objectContaining({ fileName: 'a.bin', verdict: 'intact', protocol: 'http3' }),
    ]);
  });

  it('records a changed checksum as such', async () => {
    const model = modelWith(
      fileEchoAnswering(request => {
        const outcome = intact(request);
        return { ...outcome, tally: { ...outcome.tally, receivedCrc32: 8 } };
      })
    );
    await ready(model, new File([Uint8Array.of(1, 2, 3)], 'a.bin'));

    await model.start();

    expect(model.results[0]?.verdict).toBe('checksum-mismatch');
  });

  it('shows why an echo failed', async () => {
    const model = modelWith(fileEchoAnswering(() => Promise.reject(new Error('gone'))));
    await ready(model, new File([Uint8Array.of(1)], 'a.bin'));

    await model.start();

    expect(model.state).toEqual({
      kind: 'failed',
      failure: { kind: 'unreachable', message: 'gone' },
    });
    expect(model.results).toEqual([]);
  });

  it('calls a stopped echo cancelled, not failed', async () => {
    const model = modelWith(
      fileEchoAnswering(
        ({ signal }) =>
          new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason)))
      )
    );
    await ready(model, new File([Uint8Array.of(1)], 'a.bin'));

    const running = model.start();
    await vi.waitFor(() => expect(model.state.kind).toBe('running'));
    model.cancel();
    await running;

    expect(model.state).toEqual({ kind: 'cancelled' });
  });

  it('refuses a file over the limit without opening anything', async () => {
    const openSink = vi.fn(OPENED);
    const model = modelWith(fileEchoAnswering(intact), openSink);
    await ready(model, new File([new Uint8Array(LIMITS.maxFileBytes + 1)], 'big.bin'));

    await model.start();

    expect(openSink).not.toHaveBeenCalled();
    expect(model.state).toEqual({ kind: 'too-large', size: LIMITS.maxFileBytes + 1 });
  });

  it('says so when the browser can only save by buffering the whole file', async () => {
    const model = modelWith(fileEchoAnswering(intact), () =>
      Promise.resolve({ kind: 'unavailable' })
    );
    await ready(model, new File([Uint8Array.of(1)], 'a.bin'));

    await model.start();

    expect(model.state).toEqual({ kind: 'no-streaming-save' });
  });

  it('goes back to waiting when the save dialog is dismissed', async () => {
    const model = modelWith(fileEchoAnswering(intact), () =>
      Promise.resolve({ kind: 'cancelled' })
    );
    await ready(model, new File([Uint8Array.of(1)], 'a.bin'));

    await model.start();

    expect(model.state).toEqual({ kind: 'idle' });
  });

  it('starts one echo however fast the button is pressed twice', async () => {
    const openSink = vi.fn(OPENED);
    const model = modelWith(fileEchoAnswering(intact), openSink);
    await ready(model, new File([Uint8Array.of(1, 2)], 'a.bin'));

    await Promise.all([model.start(), model.start()]);

    expect(openSink).toHaveBeenCalledTimes(1);
  });

  it('keeps every finished echo, newest first, with the protocol it ran on', async () => {
    let protocol: TransportProtocol = 'http3';
    const model = modelWith(fileEchoAnswering(intact), OPENED, () => protocol);
    await ready(model, new File([Uint8Array.of(1)], 'first.bin'));
    await model.start();
    protocol = 'websocket';
    model.select(new File([Uint8Array.of(2)], 'second.bin'));
    await model.start();

    expect(model.results.map(result => [result.fileName, result.protocol])).toEqual([
      ['second.bin', 'websocket'],
      ['first.bin', 'http3'],
    ]);
  });
});
