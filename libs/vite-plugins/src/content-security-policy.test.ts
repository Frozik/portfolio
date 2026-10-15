import { createHash } from 'node:crypto';

import type { IInlineHashes } from './content-security-policy.ts';
import { withContentSecurityPolicy } from './content-security-policy.ts';

const PAGE =
  '<!doctype html><html><head><meta charset="UTF-8"><style>html{display:none}</style>' +
  '<script>document.title="x"</script>' +
  '<script type="module" src="/app/assets/e.js"></script></head><body></body></html>';
const CHARSET_SNIFF_BYTES = 1024;

function sha256(text: string): string {
  return `'sha256-${createHash('sha256').update(text).digest('base64')}'`;
}

function build(policy: (hashes: IInlineHashes) => readonly string[]): string {
  return withContentSecurityPolicy(PAGE, {
    basePath: '/app',
    trustedScriptPrefixes: ['https://accounts.google.com/gsi/client'],
    policy,
  });
}

function policyOf(html: string): string {
  return /http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(html)?.[1] ?? '';
}

const HASHED = ({ scripts, styles }: IInlineHashes): readonly string[] => [
  ["script-src 'self'", ...scripts].join(' '),
  ["style-src 'self'", ...styles].join(' '),
];

describe('content security policy', () => {
  it('comes first in the head, before any script it governs', () => {
    const html = build(HASHED);

    expect(html.indexOf('Content-Security-Policy')).toBeLessThan(html.indexOf('<script'));
  });

  it('leaves the charset declaration first, inside the bytes a browser sniffs it from', () => {
    const html = build(HASHED);

    expect(html.indexOf('<meta charset')).toBeLessThan(html.indexOf('Content-Security-Policy'));
    expect(html.indexOf('<meta charset')).toBeLessThan(CHARSET_SNIFF_BYTES);
  });

  it('hands the policy every inline script, the Trusted Types one included', () => {
    const scripts = /script-src ([^;]*)/.exec(policyOf(build(HASHED)))?.[1] ?? '';

    expect(scripts).toContain(sha256('document.title="x"'));
    expect(scripts.match(/'sha256-/g)).toHaveLength(2);
  });

  it('hands the policy every inline style', () => {
    expect(policyOf(build(HASHED))).toContain(`style-src 'self' ${sha256('html{display:none}')}`);
  });

  it('lets the policy leave the hashes out', () => {
    expect(policyOf(build(() => ["default-src 'self'", "object-src 'none'"]))).toBe(
      "default-src 'self'; object-src 'none'"
    );
  });

  it('lets through script URLs of the site’s assets and the listed services only', () => {
    const html = build(HASHED);

    expect(html).toContain('"/app/assets/"');
    expect(html).toContain('"/app/sw.js"');
    expect(html).toContain('["https://accounts.google.com/gsi/client"]');
  });
});
