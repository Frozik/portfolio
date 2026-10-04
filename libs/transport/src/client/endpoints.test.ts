import { encodePinnedCertificate } from '../shared/pinned-certificate';
import { transportEndpoints } from './endpoints';

describe('transport endpoints', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('serves both protocols from the one host behind TLS', async () => {
    const endpoints = transportEndpoints('https://chat.example', '/transport');

    expect(endpoints.fallbackUrl).toBe('wss://chat.example/transport');
    expect(await endpoints.http3()).toEqual({ url: 'https://chat.example/transport' });
  });

  it('asks a development server for its pinned certificate and HTTP/3 port', async () => {
    const sha256 = Uint8Array.from({ length: 32 }, (_, index) => index);
    const fetchPinned = vi.fn().mockResolvedValue({
      json: () => Promise.resolve(encodePinnedCertificate({ sha256, http3Port: 4447 })),
    });
    vi.stubGlobal('fetch', fetchPinned);
    const endpoints = transportEndpoints('http://localhost:4445', '/transport');

    const target = await endpoints.http3();

    expect(fetchPinned).toHaveBeenCalledWith('http://localhost:4445/transport/pinned-certificate');
    expect(endpoints.fallbackUrl).toBe('ws://localhost:4445/transport');
    expect(target).toEqual({
      url: 'https://localhost:4447/transport',
      serverCertificateHashes: [{ algorithm: 'sha-256', value: sha256 }],
    });
  });
});
