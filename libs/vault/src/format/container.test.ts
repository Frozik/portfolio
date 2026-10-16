import * as fc from 'fast-check';
import { zipSync } from 'fflate';

import { utf8 } from '../crypto/bytes';
import { isSafeContainerPath, packContainer, unpackContainer } from './container';

const PROPERTY_SEED = 20261011;

describe('vault container', () => {
  it('unpacks exactly the files it packed, compressed or stored', () => {
    const scan = Uint8Array.from({ length: 1000 }, (_, index) => (index * 31) % 256);

    const files = unpackContainer(
      packContainer([
        { path: 'vault.json', bytes: utf8('{"name":"Vault"}'), compress: true },
        { path: 'assets/a1', bytes: scan, compress: false },
      ])
    );

    expect(files).toEqual({
      ok: true,
      value: new Map([
        ['vault.json', utf8('{"name":"Vault"}')],
        ['assets/a1', scan],
      ]),
    });
  });

  it('packs the same files to the same bytes, revealing no write time', () => {
    const entries = [{ path: 'vault.json', bytes: utf8('{}'), compress: true }];

    expect(packContainer(entries)).toEqual(packContainer(entries));
  });

  it('refuses an entry that inflates more than a hundredfold', () => {
    const bomb = packContainer([
      { path: 'cards/a.json', bytes: new Uint8Array(1 << 20), compress: true },
    ]);

    expect(unpackContainer(bomb)).toEqual({ ok: false, error: 'zip-limits' });
  });

  it('refuses more than 20 000 entries', () => {
    const many = zipSync(
      Object.fromEntries(
        Array.from({ length: 20_001 }, (_, index) => [`cards/${index}.json`, new Uint8Array(0)])
      ),
      // Stored, not deflated: the limit reads only the directory, and deflating 20 001 entries
      // took the test past its timeout on a busy CI runner.
      { level: 0 }
    );

    expect(unpackContainer(many)).toEqual({ ok: false, error: 'zip-limits' });
  });

  it('refuses a path that could leave the archive', () => {
    const escaping = zipSync({ '../outside.json': utf8('{}') });

    expect(unpackContainer(escaping)).toEqual({ ok: false, error: 'zip-limits' });
  });

  it.each([
    ['vault.json', true],
    ['cards/0190-abc.json', true],
    ['icons/negative.json', true],
    ['../x', false],
    ['a/./b', false],
    ['/abs', false],
    ['a\\b', false],
    ['', false],
    ['a//b', false],
  ])('treats %s as a safe path: %s', (path, safe) => {
    expect(isSafeContainerPath(path)).toBe(safe);
  });

  it('answers any bytes with files or a typed error, never an exception', () => {
    fc.assert(
      fc.property(fc.uint8Array({ maxLength: 400 }), randomBytes => {
        const result = unpackContainer(new Uint8Array(randomBytes));
        return result.ok || ['corrupted', 'zip-limits'].includes(result.error);
      }),
      { seed: PROPERTY_SEED }
    );
  });
});
