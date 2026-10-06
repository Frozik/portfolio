import type { AddressInfo } from 'node:net';

import { createClient } from '@connectrpc/connect';
import { PlotService } from '@frozik/proto/frozik/transport/v1/plot_pb';
import { WebSocket } from 'ws';

import type { ITransportSession, TransportProtocol } from '../shared/session';
import type { WireFormat } from '../shared/wire-format';
import { TRANSPORT_CLIENT_ADDRESS, TRANSPORT_PROTOCOL } from './peer';
import type { TestServer } from './test-server';
import {
  openGatewaySession,
  openTestSession,
  startTestServer,
  stopTestServer,
  TEST_CLIENT_ADDRESS,
  transportOver,
} from './test-server';

interface Call {
  readonly address: string | undefined;
  readonly protocol: TransportProtocol;
}

interface Running extends TestServer {
  readonly calls: Call[];
}

interface StartOptions {
  readonly maxSessionsPerIp?: number;
  readonly behindProxy?: readonly TransportProtocol[];
}

async function start(options: StartOptions = {}): Promise<Running> {
  const calls: Call[] = [];
  const server = await startTestServer({
    ...options,
    register: router =>
      router.service(PlotService, {
        getPlotLimits: (_, context) => {
          calls.push({
            address: context.values.get(TRANSPORT_CLIENT_ADDRESS),
            protocol: context.values.get(TRANSPORT_PROTOCOL),
          });
          return { expressionMaxLength: 1, sampleMaxPoints: 2 };
        },
      }),
  });
  return { ...server, calls };
}

async function askLimits(session: ITransportSession, format: WireFormat = 'binary'): Promise<void> {
  await createClient(PlotService, transportOver(session, format)).getPlotLimits({});
  session.close();
}

describe('transport server', () => {
  let running: Running | undefined;

  afterEach(async () => {
    if (running !== undefined) {
      await stopTestServer(running);
      running = undefined;
    }
  });

  it('serves the same handlers to browsers on the fallback and to the HTTP/3 gateway', async () => {
    running = await start();

    await askLimits(await openTestSession(running, 'websocket'));
    await askLimits(await openTestSession(running, 'http3'));

    expect(running.calls).toEqual([
      { address: '127.0.0.1', protocol: 'websocket' },
      { address: TEST_CLIENT_ADDRESS, protocol: 'http3' },
    ]);
  });

  it('serves a debugging browser on the JSON wire it asks for', async () => {
    running = await start();

    await askLimits(await openTestSession(running, 'websocket', 'json'), 'json');

    expect(running.calls).toEqual([{ address: '127.0.0.1', protocol: 'websocket' }]);
  });

  it('hides the address of the proxied fallback but keeps the one the gateway forwards', async () => {
    running = await start({ behindProxy: ['websocket'] });

    await askLimits(await openTestSession(running, 'websocket'));
    await askLimits(await openTestSession(running, 'http3'));

    expect(running.calls.map(call => call.address)).toEqual([undefined, TEST_CLIENT_ADDRESS]);
  });

  it('ignores gateway headers on the public listener, so nobody can claim an address there', async () => {
    running = await start();

    await askLimits(
      await openGatewaySession(running, { clientAddress: '198.51.100.1' }, running.http)
    );

    expect(running.calls).toEqual([{ address: '127.0.0.1', protocol: 'websocket' }]);
  });

  it.each([
    ['a wrong secret', { secret: 'guessed' }],
    ['no client address', { clientAddress: '' }],
    ['another protocol version', { subprotocol: 'frozik-mux.v0' }],
    ['the JSON wire, which is for browsers only', { subprotocol: 'frozik-mux-json.v1' }],
    ['a page from a foreign origin', { origin: 'https://evil.example' }],
  ])('refuses a gateway session with %s', async (_, headers) => {
    running = await start();

    await expect(openGatewaySession(running, headers)).rejects.toThrow();
  });

  it('counts sessions per forwarded address, not per gateway', async () => {
    running = await start({ maxSessionsPerIp: 1 });

    const first = await openGatewaySession(running, { clientAddress: '198.51.100.1' });
    const second = await openGatewaySession(running, { clientAddress: '198.51.100.2' });
    await expect(openGatewaySession(running, { clientAddress: '198.51.100.1' })).rejects.toThrow();

    first.close();
    second.close();
  });

  it('still takes a browser bundle from before the subprotocol was named', async () => {
    running = await start();
    const { port } = running.http.address() as AddressInfo;
    const socket = new WebSocket(`ws://127.0.0.1:${port}/transport`);

    await new Promise((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    });

    expect(socket.protocol).toBe('');
    socket.close();
  });
});
