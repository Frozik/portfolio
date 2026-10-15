import { platformAuthenticatorOf } from './platform-authenticator';

describe('the platform authenticator', () => {
  it.each([
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15', 'face-id'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15', 'touch-id'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0', 'windows-hello'],
    ['Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 Chrome/130.0', 'fingerprint'],
    ['Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0', 'passkey'],
  ] as const)('of %s is %s', (userAgent, authenticator) => {
    expect(platformAuthenticatorOf(userAgent)).toBe(authenticator);
  });
});
