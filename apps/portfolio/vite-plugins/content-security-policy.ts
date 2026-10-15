import type { IContentSecurityPolicyOptions } from '@frozik/vite-plugins/content-security-policy';

/** Script URLs the page loads from elsewhere: Google sign-in, Cloudflare's beacon, MediaPipe. */
const THIRD_PARTY_SCRIPTS = [
  'https://accounts.google.com/gsi/client',
  'https://static.cloudflareinsights.com/beacon.min.js',
  'https://cdn.jsdelivr.net/npm/@mediapipe/',
] as const;

/**
 * The portfolio's CSP: scripts pinned to hashes and the three paths above;
 * styles stay `'unsafe-inline'` because the prerendered landing and React
 * write `style` attributes (known debt).
 */
export function portfolioContentSecurityPolicy({
  communicationUrl,
  basePath,
}: {
  readonly communicationUrl: string;
  readonly basePath: string;
}): IContentSecurityPolicyOptions {
  const communication = new URL(communicationUrl);
  const socket = `${communication.protocol === 'https:' ? 'wss' : 'ws'}://${communication.host}`;
  return {
    basePath,
    trustedScriptPrefixes: THIRD_PARTY_SCRIPTS,
    policy: ({ scripts }) => [
      "default-src 'self'",
      ["script-src 'self' 'wasm-unsafe-eval'", ...scripts, ...THIRD_PARTY_SCRIPTS].join(' '),
      "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "media-src 'self' blob: data:",
      "worker-src 'self' blob:",
      "frame-src 'self' https://accounts.google.com",
      [
        "connect-src 'self'",
        communication.origin,
        socket,
        'https://api.binance.com',
        'wss://stream.binance.com:9443',
        'https://tile.openstreetmap.org',
        'https://tiles.openfreemap.org',
        'https://login.yandex.ru',
        'https://accounts.google.com',
        'https://cloudflareinsights.com',
        'https://cdn.jsdelivr.net/npm/@mediapipe/',
        'https://storage.googleapis.com/mediapipe-models/',
        'https://www.googleapis.com/drive/v3/',
        'https://www.googleapis.com/upload/drive/v3/',
        'https://api.pwnedpasswords.com/range/',
        'https://api.2fa.directory/v4/',
        'https://icon.horse/icon/',
        'https://favicone.com/',
      ].join(' '),
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'self'",
      "require-trusted-types-for 'script'",
    ],
  };
}
