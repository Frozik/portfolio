import { describe, expect, it } from 'vitest';
import { issueTurnCredentials } from './IssueTurnCredentialsUseCase';

describe('issueTurnCredentials', () => {
  it('produces deterministic username + credential for fixed inputs', () => {
    const result = issueTurnCredentials({
      userIdHash: 'abcdef0123456789',
      sharedSecret: 'test-secret',
      ttlSec: 3_600,
      urls: ['turns:turn-1.2.3.4.sslip.io:443?transport=tcp'],
      // 1_700_000_000_000 ms = 1_700_000_000 sec; +3600 = 1_700_003_600
      nowMs: 1_700_000_000_000,
    });
    expect(result.username).toBe('1700003600:abcdef0123456789');
    // Computed via Node REPL: createHmac('sha1','test-secret').update(username).digest('base64')
    expect(result.credential).toBe('4U2q5TZ1WsdkbQSGkl0x+bFkFeo=');
    expect(result.ttl).toBe(3_600);
    expect(result.urls).toEqual(['turns:turn-1.2.3.4.sslip.io:443?transport=tcp']);
  });

  it('rounds nowMs down to seconds before adding ttl', () => {
    const result = issueTurnCredentials({
      userIdHash: 'abcdef0123456789',
      sharedSecret: 'test-secret',
      ttlSec: 60,
      urls: [],
      // 1_700_000_000_999 ms — fractional second portion must be discarded.
      nowMs: 1_700_000_000_999,
    });
    expect(result.username).toBe('1700000060:abcdef0123456789');
  });
});
