import { createHash } from 'node:crypto';

import { withContentSecurityPolicy } from './content-security-policy';

const PAGE =
  '<!doctype html><html><head><meta charset="UTF-8"><script>document.title="x"</script>' +
  '<script type="module" src="/portfolio/assets/e.js"></script></head><body></body></html>';
const OPTIONS = { communicationUrl: 'https://signal.example.org', basePath: '/portfolio/' };

function policyOf(html: string): string {
  return /http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(html)?.[1] ?? '';
}

describe('content security policy', () => {
  it('comes first in the head, before any script it governs', () => {
    const html = withContentSecurityPolicy(PAGE, OPTIONS);

    expect(html.indexOf('Content-Security-Policy')).toBeLessThan(html.indexOf('<script'));
  });

  it('allows each inline script by its hash, the Trusted Types policy included', () => {
    const html = withContentSecurityPolicy(PAGE, OPTIONS);
    const hash = `'sha256-${createHash('sha256').update('document.title="x"').digest('base64')}'`;

    expect(policyOf(html)).toContain(hash);
    expect(policyOf(html).match(/'sha256-/g)).toHaveLength(2);
  });

  it('enforces Trusted Types and opens the signalling server for fetch and WebSocket', () => {
    const policy = policyOf(withContentSecurityPolicy(PAGE, OPTIONS));

    expect(policy).toContain("require-trusted-types-for 'script'");
    expect(policy).toContain('https://signal.example.org');
    expect(policy).toContain('wss://signal.example.org');
    expect(policy).toContain("object-src 'none'");
  });

  it('lets the vault reach Google Drive’s API, and no other path on that host', () => {
    const connect =
      /connect-src ([^;]*)/.exec(policyOf(withContentSecurityPolicy(PAGE, OPTIONS)))?.[1] ?? '';

    expect(connect.split(' ')).toEqual(
      expect.arrayContaining([
        'https://www.googleapis.com/drive/v3/',
        'https://www.googleapis.com/upload/drive/v3/',
      ])
    );
    expect(connect.split(' ')).not.toContain('https://www.googleapis.com');
  });

  it('lets the vault audit reach the breach range API and the 2FA list, by path only', () => {
    const connect =
      /connect-src ([^;]*)/.exec(policyOf(withContentSecurityPolicy(PAGE, OPTIONS)))?.[1] ?? '';

    expect(connect.split(' ')).toEqual(
      expect.arrayContaining([
        'https://api.pwnedpasswords.com/range/',
        'https://api.2fa.directory/v4/',
      ])
    );
  });

  it('lets the vault fetch site icons from the icon services only', () => {
    const connect =
      /connect-src ([^;]*)/.exec(policyOf(withContentSecurityPolicy(PAGE, OPTIONS)))?.[1] ?? '';

    expect(connect.split(' ')).toEqual(
      expect.arrayContaining(['https://icon.horse/icon/', 'https://favicone.com/'])
    );
    expect(connect.split(' ')).not.toContain('https:');
  });
});
