import type { IContentSecurityPolicyOptions } from '@frozik/vite-plugins/content-security-policy';

/** Google sign-in for Drive: its script, the styles it injects, its frame and its token endpoint. */
const GOOGLE_SIGN_IN_SCRIPT = 'https://accounts.google.com/gsi/client';
const GOOGLE_SIGN_IN_STYLE = 'https://accounts.google.com/gsi/style';
const GOOGLE_ACCOUNTS = 'https://accounts.google.com';

/** Every host the app talks to, by path where the service has one: Drive, the breach range API, the 2FA list, the icon services. */
const CONNECT_HOSTS = [
  GOOGLE_ACCOUNTS,
  'https://www.googleapis.com/drive/v3/',
  'https://www.googleapis.com/upload/drive/v3/',
  'https://api.pwnedpasswords.com/range/',
  'https://api.2fa.directory/v4/',
  'https://icon.horse/icon/',
  'https://favicone.com/',
] as const;

/**
 * Ciphra Vault's CSP: no analytics beacon, no `'unsafe-inline'` anywhere —
 * the anti-framing style and every inline script are allowed by their hash.
 */
export function vaultWebContentSecurityPolicy(): IContentSecurityPolicyOptions {
  return {
    basePath: '',
    trustedScriptPrefixes: [GOOGLE_SIGN_IN_SCRIPT],
    policy: ({ scripts, styles }) => [
      "default-src 'self'",
      ["script-src 'self' 'wasm-unsafe-eval'", ...scripts, GOOGLE_SIGN_IN_SCRIPT].join(' '),
      ["style-src 'self'", ...styles, GOOGLE_SIGN_IN_STYLE].join(' '),
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      `frame-src ${GOOGLE_ACCOUNTS}`,
      ["connect-src 'self'", ...CONNECT_HOSTS].join(' '),
      "object-src 'none'",
      "base-uri 'none'",
      "form-action 'none'",
      "require-trusted-types-for 'script'",
    ],
  };
}
