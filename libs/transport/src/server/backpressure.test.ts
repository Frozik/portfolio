import { create } from '@bufbuild/protobuf';
import type { ConnectRouter } from '@connectrpc/connect';
import { createClient } from '@connectrpc/connect';
import type { EchoRequest } from '@frozik/proto/frozik/transport/v1/file_pb';
import { EchoRequestSchema, FileService } from '@frozik/proto/frozik/transport/v1/file_pb';

import { MUX_PROTOCOL_LIMITS } from '../mux/mux-limits';
import type { ITransportSession, TransportProtocol } from '../shared/session';
import type { TestServer } from './test-server';
import { openTestSession, startTestServer, stopTestServer, transportOver } from './test-server';

const CHUNK_BYTES = 16 * 1024;
const STALL_WAIT_MS = 300;
/** A loaded machine needs a few rounds to stall; a sender that never stalls fails after these. */
const MAX_SETTLE_ROUNDS = 10;
/** Messages in flight between a generator and the wire: Connect, the frame writer, the stream queues. */
const IN_FLIGHT_MESSAGES = 16;
const PROTOCOLS: readonly TransportProtocol[] = ['http3', 'websocket'];

interface CountingSender {
  readonly requests: AsyncGenerator<EchoRequest>;
  readonly sent: () => number;
}

/** An endless file that counts how much of it the transport has pulled. */
function countingSender(): CountingSender {
  let sent = 0;
  async function* requests(): AsyncGenerator<EchoRequest> {
    for (;;) {
      sent += CHUNK_BYTES;
      yield create(EchoRequestSchema, {
        part: { case: 'chunk', value: new Uint8Array(CHUNK_BYTES) },
      });
    }
  }
  return { requests: requests(), sent: () => sent };
}

/** Waits until the counter stops moving and returns where it stopped; fails if it never does. */
async function settledAt(counter: () => number): Promise<number> {
  let previous = counter();
  for (let round = 0; round < MAX_SETTLE_ROUNDS; round += 1) {
    await new Promise(resolve => setTimeout(resolve, STALL_WAIT_MS));
    const current = counter();
    if (current === previous) {
      return current;
    }
    previous = current;
  }
  throw new Error(`still moving after ${MAX_SETTLE_ROUNDS} rounds, at ${previous} bytes`);
}

function windowOf(protocol: TransportProtocol, running: TestServer): number {
  switch (protocol) {
    case 'http3':
      return running.streamWindowBytes;
    case 'websocket':
      return MUX_PROTOCOL_LIMITS.initialCredit;
  }
}

describe.each(PROTOCOLS)('backpressure over %s', protocol => {
  let running: TestServer | undefined;
  let session: ITransportSession | undefined;
  let controller: AbortController;

  async function connect(register: (router: ConnectRouter) => void) {
    running = await startTestServer({ register });
    session = await openTestSession(running, protocol);
    return {
      files: createClient(FileService, transportOver(session)),
      window: windowOf(protocol, running),
    };
  }

  beforeEach(() => {
    controller = new AbortController();
  });

  afterEach(async () => {
    controller.abort();
    session?.close();
    session = undefined;
    if (running !== undefined) {
      await stopTestServer(running);
      running = undefined;
    }
  });

  it('stops the client sending within one window when the handler does not read', async () => {
    const { files, window } = await connect(router =>
      router.service(FileService, {
        // oxlint-disable-next-line require-yield -- never reads nor answers: the client must stall
        async *echo() {
          await new Promise(() => undefined);
        },
      })
    );
    const sender = countingSender();

    const responses = files.echo(sender.requests, { signal: controller.signal });

    const reading = responses[Symbol.asyncIterator]().next();

    expect(await settledAt(sender.sent)).toBeLessThan(window + IN_FLIGHT_MESSAGES * CHUNK_BYTES);
    controller.abort();
    await reading.catch(() => undefined);
  });

  it('stops the handler producing within one window when the client does not read', async () => {
    let produced = 0;
    const { files, window } = await connect(router =>
      router.service(FileService, {
        async *echo() {
          for (;;) {
            produced += CHUNK_BYTES;
            yield { part: { case: 'chunk', value: new Uint8Array(CHUNK_BYTES) } };
          }
        },
      })
    );
    async function* headerOnly(): AsyncGenerator<EchoRequest> {
      yield create(EchoRequestSchema, { part: { case: 'header', value: { name: 'a', size: 0n } } });
      await new Promise(() => undefined);
    }

    await files.echo(headerOnly(), { signal: controller.signal })[Symbol.asyncIterator]().next();

    expect(await settledAt(() => produced)).toBeLessThan(window + IN_FLIGHT_MESSAGES * CHUNK_BYTES);
  });

  it('stops the client sending within two windows through an echo it does not read', async () => {
    const { files, window } = await connect(router =>
      router.service(FileService, {
        async *echo(requests) {
          for await (const request of requests) {
            if (request.part.case === 'chunk') {
              yield { part: { case: 'chunk', value: request.part.value } };
            }
          }
        },
      })
    );
    const sender = countingSender();

    await files.echo(sender.requests, { signal: controller.signal })[Symbol.asyncIterator]().next();

    expect(await settledAt(sender.sent)).toBeLessThan(
      window * 2 + IN_FLIGHT_MESSAGES * CHUNK_BYTES
    );
  });
});
