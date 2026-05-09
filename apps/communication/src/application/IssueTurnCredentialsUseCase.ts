import { createHmac } from 'node:crypto';

const MS_PER_SECOND = 1_000;

export type IssueTurnCredentialsInput = {
  userIdHash: string;
  sharedSecret: string;
  ttlSec: number;
  urls: ReadonlyArray<string>;
  nowMs: number;
};

export type IssueTurnCredentialsOutput = {
  username: string;
  credential: string;
  ttl: number;
  urls: ReadonlyArray<string>;
};

// coturn `use-auth-secret`-style credential. `username` is `<unix-expiry>:<userIdHash>`,
// `credential` is `base64(HMAC-SHA1(sharedSecret, username))`.
export function issueTurnCredentials(input: IssueTurnCredentialsInput): IssueTurnCredentialsOutput {
  const unixExpirySec = Math.floor(input.nowMs / MS_PER_SECOND) + input.ttlSec;
  const username = `${unixExpirySec}:${input.userIdHash}`;
  const credential = createHmac('sha1', input.sharedSecret).update(username).digest('base64');
  return { username, credential, ttl: input.ttlSec, urls: input.urls };
}
