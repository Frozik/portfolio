import { z } from 'zod';

/**
 * Development servers run HTTP/3 on a self-signed certificate on a UDP port of
 * their own. The browser pins the certificate by hash, so the server publishes
 * both at `<transport path>/pinned-certificate` and the client reads them from
 * there before connecting. Both ends share this module, so the wire cannot drift.
 */
export const PINNED_CERTIFICATE_SUFFIX = '/pinned-certificate';

const PinnedCertificateSchema = z.object({ sha256: z.string(), http3Port: z.number().int() });

export type PinnedCertificateBody = z.infer<typeof PinnedCertificateSchema>;

export interface PinnedCertificate {
  readonly sha256: Uint8Array<ArrayBuffer>;
  readonly http3Port: number;
}

export function encodePinnedCertificate(certificate: PinnedCertificate): PinnedCertificateBody {
  return {
    sha256: btoa(String.fromCharCode(...certificate.sha256)),
    http3Port: certificate.http3Port,
  };
}

export function decodePinnedCertificate(body: unknown): PinnedCertificate {
  const parsed = PinnedCertificateSchema.parse(body);
  return {
    sha256: Uint8Array.from(atob(parsed.sha256), character => character.charCodeAt(0)),
    http3Port: parsed.http3Port,
  };
}
