import type { ITransportSession } from '../shared/session';

export function isWebTransportAvailable(): boolean {
  return typeof globalThis.WebTransport === 'function';
}

export function openWebTransport(
  url: string,
  serverCertificateHashes: readonly WebTransportHash[] | undefined
): ITransportSession {
  const transport = new WebTransport(url, {
    serverCertificateHashes:
      serverCertificateHashes === undefined ? undefined : [...serverCertificateHashes],
    congestionControl: 'throughput',
  });
  return {
    ready: transport.ready,
    closed: transport.closed,
    incomingBidirectionalStreams: transport.incomingBidirectionalStreams,
    createBidirectionalStream: () => transport.createBidirectionalStream(),
    close: () => transport.close(),
  };
}
