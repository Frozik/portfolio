// @peculiar/x509 resolves its services through tsyringe, which needs the Reflect metadata API.
import 'reflect-metadata';

import {
  cryptoProvider,
  PemConverter,
  SubjectAlternativeNameExtension,
  X509CertificateGenerator,
} from '@peculiar/x509';
import { Temporal } from 'temporal-polyfill';

export interface SelfSignedCertificate {
  readonly cert: string;
  readonly key: string;
  /** SHA-256 of the DER certificate, for the browser's `serverCertificateHashes`. */
  readonly sha256: Uint8Array<ArrayBuffer>;
}

/** Browsers accept a pinned self-signed WebTransport certificate only when it lives at most 14 days. */
const VALIDITY = Temporal.Duration.from({ hours: 13 * 24 });
const ALGORITHM = { name: 'ECDSA', namedCurve: 'P-256', hash: 'SHA-256' } as const;

/** A development-only certificate for `localhost`, pinned by hash instead of trusted by a CA. */
export async function createSelfSignedCertificate(): Promise<SelfSignedCertificate> {
  cryptoProvider.set(globalThis.crypto);
  const keys = await crypto.subtle.generateKey(ALGORITHM, true, ['sign', 'verify']);
  const now = Temporal.Now.instant();
  const certificate = await X509CertificateGenerator.createSelfSigned({
    serialNumber: now.epochMilliseconds.toString(16),
    name: 'CN=localhost',
    // oxlint-disable-next-line no-restricted-globals -- @peculiar/x509 takes the validity window only as Date
    notBefore: new Date(now.epochMilliseconds),
    // oxlint-disable-next-line no-restricted-globals -- @peculiar/x509 takes the validity window only as Date
    notAfter: new Date(now.add(VALIDITY).epochMilliseconds),
    keys,
    signingAlgorithm: ALGORITHM,
    extensions: [
      new SubjectAlternativeNameExtension([
        { type: 'dns', value: 'localhost' },
        { type: 'ip', value: '127.0.0.1' },
        { type: 'ip', value: '::1' },
      ]),
    ],
  });
  const privateKey = await crypto.subtle.exportKey('pkcs8', keys.privateKey);
  return {
    cert: certificate.toString('pem'),
    key: PemConverter.encode(privateKey, 'PRIVATE KEY'),
    sha256: new Uint8Array(await crypto.subtle.digest('SHA-256', certificate.rawData)),
  };
}
