import { createClient } from '@connectrpc/connect';
import { PlotService } from '@frozik/proto/frozik/transport/v1/plot_pb';

import type { TransportProtocol } from '../shared/session';
import { TRANSPORT_CLIENT_ADDRESS } from './peer';
import type { SelfSignedCertificate } from './self-signed-certificate';
import { createSelfSignedCertificate } from './self-signed-certificate';
import type { TestServer } from './test-server';
import { openTestSession, startTestServer, stopTestServer, transportOver } from './test-server';

interface Running extends TestServer {
  readonly clientAddresses: (string | undefined)[];
}

interface StartOptions {
  readonly certificate?: SelfSignedCertificate | 'self-signed';
  readonly maxSessionsPerIp?: number;
  readonly behindProxy?: readonly TransportProtocol[];
}

async function start(options: StartOptions = {}): Promise<Running> {
  const clientAddresses: (string | undefined)[] = [];
  const server = await startTestServer({
    ...options,
    register: router =>
      router.service(PlotService, {
        getPlotLimits: (_, context) => {
          clientAddresses.push(context.values.get(TRANSPORT_CLIENT_ADDRESS));
          return { expressionMaxLength: 1, sampleMaxPoints: 2 };
        },
      }),
  });
  return { ...server, clientAddresses };
}

describe('transport server', () => {
  let running: Running | undefined;

  afterEach(async () => {
    if (running !== undefined) {
      await stopTestServer(running);
      running = undefined;
    }
  });

  it('serves the same Connect handlers over HTTP/3 and over the WebSocket fallback', async () => {
    running = await start();
    const sessions = [
      await openTestSession(running, 'http3'),
      await openTestSession(running, 'websocket'),
    ];

    for (const session of sessions) {
      const limits = await createClient(PlotService, transportOver(session)).getPlotLimits({});
      expect(limits.sampleMaxPoints).toBe(2);
      session.close();
    }
    expect(running.clientAddresses).toEqual(['127.0.0.1', '127.0.0.1']);
  });

  it('hides the address of a session that came through a proxy', async () => {
    running = await start({ behindProxy: ['websocket'] });
    const session = await openTestSession(running, 'websocket');

    await createClient(PlotService, transportOver(session)).getPlotLimits({});

    expect(running.clientAddresses).toEqual([undefined]);
    session.close();
  });

  it('refuses sessions past the per-address cap', async () => {
    running = await start({ maxSessionsPerIp: 0 });

    await expect(openTestSession(running, 'http3')).rejects.toThrow();
    await expect(openTestSession(running, 'websocket')).rejects.toThrow();
  });

  it('presents a reloaded certificate to new sessions', async () => {
    running = await start({ certificate: await createSelfSignedCertificate() });
    const replacement = await createSelfSignedCertificate();

    await running.server.reloadCertificate(replacement);

    const session = await openTestSession(running, 'http3', replacement.sha256);
    const limits = await createClient(PlotService, transportOver(session)).getPlotLimits({});
    expect(limits.expressionMaxLength).toBe(1);
    session.close();
  });
});
