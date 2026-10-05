import type { IBidirectionalStream } from '../shared/session';
import { createMemorySessionPair, TEST_MUX_LIMITS } from '../testing/memory-session';
import { createMemorySocketPair } from '../testing/memory-socket';
import { encodeMuxMessage, MUX_TYPE } from './mux-message';
import { createMuxSession } from './mux-session';

const STALL_WAIT_MS = 50;

async function acceptOne(
  streams: ReadableStream<IBidirectionalStream>
): Promise<IBidirectionalStream> {
  const reader = streams.getReader();
  const { value } = await reader.read();
  reader.releaseLock();
  if (value === undefined) {
    throw new Error('no incoming stream');
  }
  return value;
}

async function readAll(readable: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  for await (const part of readable) {
    parts.push(part);
  }
  const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
  const all = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    all.set(part, offset);
    offset += part.byteLength;
  }
  return all;
}

function patterned(size: number, seed: number): Uint8Array {
  const bytes = new Uint8Array(size);
  for (let index = 0; index < size; index += 1) {
    bytes[index] = (index * 31 + seed) & 0xff;
  }
  return bytes;
}

describe('WebSocket multiplexer', () => {
  it('delivers each stream intact and in order while several run at once', async () => {
    const { client, server } = createMemorySessionPair();
    const payloads = [patterned(300_000, 1), patterned(70_000, 2), patterned(1, 3)];

    const echoing = (async () => {
      const incoming = server.incomingBidirectionalStreams.getReader();
      for (let count = 0; count < payloads.length; count += 1) {
        const { value: stream } = await incoming.read();
        void stream?.readable.pipeTo(stream.writable);
      }
    })();

    const results = await Promise.all(
      payloads.map(async payload => {
        const stream = await client.createBidirectionalStream();
        const writer = stream.writable.getWriter();
        const sending = writer.write(payload).then(() => writer.close());
        const echoed = await readAll(stream.readable);
        await sending;
        return echoed;
      })
    );
    await echoing;
    expect(results).toEqual(payloads);
  });

  it('stops the sender once the credit is spent while nobody reads on the other side', async () => {
    const { client, server } = createMemorySessionPair();
    const stream = await client.createBidirectionalStream();
    await acceptOne(server.incomingBidirectionalStreams);

    const writer = stream.writable.getWriter();
    let written = 0;
    const chunk = new Uint8Array(4 * 1024);
    const writing = (async () => {
      for (;;) {
        await writer.ready;
        await writer.write(chunk);
        written += chunk.byteLength;
      }
    })();
    await new Promise(resolve => setTimeout(resolve, STALL_WAIT_MS));

    expect(written).toBeLessThanOrEqual(TEST_MUX_LIMITS.initialCredit);
    expect(written).toBeGreaterThan(0);
    client.close();
    await expect(writing).rejects.toThrow();
  });

  it('resumes the sender as soon as the receiver reads', async () => {
    const { client, server } = createMemorySessionPair();
    const stream = await client.createBidirectionalStream();
    const accepted = await acceptOne(server.incomingBidirectionalStreams);
    const payload = patterned(TEST_MUX_LIMITS.initialCredit * 5, 7);

    const writer = stream.writable.getWriter();
    const sending = writer.write(payload).then(() => writer.close());
    expect(await readAll(accepted.readable)).toEqual(payload);
    await sending;
  });

  it('drops the whole session when the peer sends past its credit', async () => {
    const [rawClient, serverSocket] = createMemorySocketPair();
    const server = createMuxSession(serverSocket, { ...TEST_MUX_LIMITS, role: 'server' });
    rawClient.send(encodeMuxMessage({ type: MUX_TYPE.open, streamId: 1 }));
    const flood = new Uint8Array(TEST_MUX_LIMITS.maxDataBytes);
    for (let sent = 0; sent <= TEST_MUX_LIMITS.initialCredit; sent += flood.byteLength) {
      rawClient.send(encodeMuxMessage({ type: MUX_TYPE.data, streamId: 1, bytes: flood }));
    }
    await server.closed;
    await expect(serverSocket.closed).resolves.toBeUndefined();
  });

  it('ignores everything the peer sends after it broke the protocol', () => {
    let deliver: (message: Uint8Array) => void = () => undefined;
    const closing = Promise.withResolvers<void>();
    // Like `ws`: close() only starts the closing handshake; messages already
    // received keep arriving.
    createMuxSession(
      {
        opened: Promise.resolve(),
        closed: closing.promise,
        bufferedAmount: 0,
        send: () => undefined,
        close: () => closing.resolve(),
        onMessage: listener => {
          deliver = listener;
        },
      },
      { ...TEST_MUX_LIMITS, role: 'server' }
    );

    expect(() => {
      deliver(new Uint8Array([9, 0, 0, 0, 1]));
      deliver(encodeMuxMessage({ type: MUX_TYPE.open, streamId: 1 }));
      deliver(encodeMuxMessage({ type: MUX_TYPE.data, streamId: 1, bytes: new Uint8Array(1) }));
    }).not.toThrow();
  });

  it('refuses streams beyond the limit without dropping the ones already open', async () => {
    const limits = { ...TEST_MUX_LIMITS, maxIncomingStreams: 1 };
    const { client, server } = createMemorySessionPair(limits);
    const first = await client.createBidirectionalStream();
    const second = await client.createBidirectionalStream();
    const accepted = await acceptOne(server.incomingBidirectionalStreams);

    await expect(second.readable.getReader().read()).rejects.toThrow(/reset/);

    const writer = first.writable.getWriter();
    await writer.write(new Uint8Array([1, 2, 3]));
    await writer.close();
    expect(await readAll(accepted.readable)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('frees a stream once both sides finished, even if the reader stops at its own end marker', async () => {
    const limits = { ...TEST_MUX_LIMITS, maxIncomingStreams: 1 };
    const { client, server } = createMemorySessionPair(limits);

    // A Connect handler reads the request up to its END frame and never asks for
    // the end of the stream; the slot must come back all the same.
    for (let call = 0; call < 3; call += 1) {
      const stream = await client.createBidirectionalStream();
      const request = stream.writable.getWriter();
      await request.write(new Uint8Array([call]));
      await request.close();
      const accepted = await acceptOne(server.incomingBidirectionalStreams);
      const incoming = accepted.readable.getReader();
      await incoming.read();
      incoming.releaseLock();
      await accepted.writable.getWriter().close();

      await expect(readAll(stream.readable)).resolves.toEqual(new Uint8Array());
    }
  });

  it('fails the peer stream both ways when one side aborts it', async () => {
    const { client, server } = createMemorySessionPair();
    const stream = await client.createBidirectionalStream();
    const accepted = await acceptOne(server.incomingBidirectionalStreams);

    await stream.writable.abort(new Error('user cancelled'));

    await expect(accepted.readable.getReader().read()).rejects.toThrow(/reset/);
    await expect(accepted.writable.getWriter().write(new Uint8Array([1]))).rejects.toThrow(/reset/);
  });

  it('fails every open stream when the socket closes', async () => {
    const { client, server } = createMemorySessionPair();
    const stream = await client.createBidirectionalStream();
    await acceptOne(server.incomingBidirectionalStreams);

    server.close();

    await expect(stream.readable.getReader().read()).rejects.toThrow(/closed/);
    await expect(client.createBidirectionalStream()).rejects.toThrow(/closed/);
  });
});
