// @peculiar/x509 resolves its services through tsyringe, which needs the Reflect metadata API.
import 'reflect-metadata';

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { X509Certificate } from '@peculiar/x509';
import { Temporal } from 'temporal-polyfill';

import { createSelfSignedCertificate } from './self-signed-certificate';

const CERT_FILE = 'cert.pem';
const KEY_FILE = 'key.pem';
/** A certificate this close to its end is replaced, so a browser never pins one that expires mid-session. */
const RENEW_BEFORE = Temporal.Duration.from({ hours: 24 });

/**
 * The development certificate the HTTP/3 gateway serves and browsers pin by
 * hash: reused from `dir` while it has a day left, made anew otherwise. The
 * gateway reads the same two files and picks a new pair up on its own.
 */
export async function ensureDevCertificate(dir: string): Promise<Uint8Array<ArrayBuffer>> {
  const existing = await readValidCertificate(join(dir, CERT_FILE));
  if (existing !== undefined) {
    return existing;
  }
  const created = await createSelfSignedCertificate();
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, KEY_FILE), created.key);
  await writeFile(join(dir, CERT_FILE), created.cert);
  return created.sha256;
}

async function readValidCertificate(path: string): Promise<Uint8Array<ArrayBuffer> | undefined> {
  const pem = await readFile(path, 'utf8').catch(() => undefined);
  if (pem === undefined) {
    return undefined;
  }
  const certificate = new X509Certificate(pem);
  const renewAt = Temporal.Instant.fromEpochMilliseconds(certificate.notAfter.getTime()).subtract(
    RENEW_BEFORE
  );
  if (Temporal.Instant.compare(Temporal.Now.instant(), renewAt) >= 0) {
    return undefined;
  }
  return new Uint8Array(await crypto.subtle.digest('SHA-256', certificate.rawData));
}
