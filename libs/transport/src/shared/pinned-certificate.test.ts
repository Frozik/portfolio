import { decodePinnedCertificate, encodePinnedCertificate } from './pinned-certificate';

describe('pinned certificate', () => {
  it('round-trips the hash and the port through JSON', () => {
    const certificate = {
      sha256: Uint8Array.from({ length: 32 }, (_, index) => index * 7),
      http3Port: 4447,
    };

    const body = JSON.parse(JSON.stringify(encodePinnedCertificate(certificate))) as unknown;

    expect(decodePinnedCertificate(body)).toEqual(certificate);
  });

  it('refuses a body that is not one', () => {
    expect(() => decodePinnedCertificate({ sha256: 1 })).toThrow();
  });
});
