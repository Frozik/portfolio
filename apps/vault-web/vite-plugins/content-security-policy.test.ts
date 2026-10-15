import { withContentSecurityPolicy } from '@frozik/vite-plugins/content-security-policy';

import { vaultWebContentSecurityPolicy } from './content-security-policy.ts';

const PAGE =
  '<!doctype html><html><head><meta charset="UTF-8"><style>html{display:none}</style>' +
  '<script>document.title="x"</script></head><body></body></html>';

function directives(): ReadonlyMap<string, readonly string[]> {
  const html = withContentSecurityPolicy(PAGE, vaultWebContentSecurityPolicy());
  const content = /http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(html)?.[1] ?? '';
  return new Map(
    content.split('; ').map(directive => {
      const [name = '', ...sources] = directive.split(' ');
      return [name, sources];
    })
  );
}

describe('Ciphra Vault’s content security policy', () => {
  it('allows nothing inline but what the page carries, by hash', () => {
    const policy = directives();

    expect(policy.get('script-src')).not.toContain("'unsafe-inline'");
    expect(policy.get('style-src')).not.toContain("'unsafe-inline'");
    expect(policy.get('script-src')?.filter(source => source.startsWith("'sha256-"))).toHaveLength(
      2
    );
    expect(policy.get('style-src')?.filter(source => source.startsWith("'sha256-"))).toHaveLength(
      1
    );
  });

  it('loads no analytics beacon', () => {
    const everything = [...directives().values()].flat();

    expect(everything.some(source => source.includes('cloudflareinsights'))).toBe(false);
  });

  it('reaches only the listed services, by path, and never any https host', () => {
    expect(directives().get('connect-src')).toEqual([
      "'self'",
      'https://accounts.google.com',
      'https://www.googleapis.com/drive/v3/',
      'https://www.googleapis.com/upload/drive/v3/',
      'https://api.pwnedpasswords.com/range/',
      'https://api.2fa.directory/v4/',
      'https://icon.horse/icon/',
      'https://favicone.com/',
    ]);
  });

  it('enforces Trusted Types and refuses plugins, base changes and form posts', () => {
    const policy = directives();

    expect(policy.get('require-trusted-types-for')).toEqual(["'script'"]);
    expect(policy.get('object-src')).toEqual(["'none'"]);
    expect(policy.get('base-uri')).toEqual(["'none'"]);
    expect(policy.get('form-action')).toEqual(["'none'"]);
  });
});
