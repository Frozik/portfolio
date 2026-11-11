import { decodeDocument, encodeDocument } from '../format/document-codec';
import { mergeDocument } from '../merge/merge-document';
import { aCardWith, aDocument, aField, anHlc } from '../testing/builders';
import { iconDomainOf, setSiteIcon, SITE_ICON_RETRY_MS, siteIconsWanted } from './site-icons';

const URL_SPEC = { kind: 'url', match: 'host', useSharedCredentials: true } as const;
const PNG = Uint8Array.of(0x89, 0x50, 0x4e, 0x47);

describe('site icons', () => {
  it('belong to the site of a card’s first address, else to its email’s domain', () => {
    expect(iconDomainOf(aCardWith([aField(URL_SPEC, ['https://accounts.github.com/login'])]))).toBe(
      'github.com'
    );
    expect(iconDomainOf(aCardWith([aField({ kind: 'email' }, 'jane@mail.example.org')]))).toBe(
      'mail.example.org'
    );
    expect(iconDomainOf(aCardWith([aField({ kind: 'text' }, 'nothing')]))).toBeNull();
  });

  it('are wanted for cards with the automatic icon, a "none" again only after its wait', () => {
    const github = aCardWith([aField(URL_SPEC, ['https://github.com'])]);
    const chosen = aCardWith([aField(URL_SPEC, ['https://chosen.example'])], {
      icon: { kind: 'builtin', name: 'key' },
    });
    const without = aCardWith([aField(URL_SPEC, ['https://noicon.example'])]);
    const document = setSiteIcon(aDocument([github, chosen, without]), 'noicon.example', {
      kind: 'none',
      at: anHlc(1000),
      reach: 1,
    });

    expect(siteIconsWanted(document, 2000, 1)).toEqual(['github.com']);
    expect(siteIconsWanted(document, 1000 + SITE_ICON_RETRY_MS, 1)).toEqual([
      'github.com',
      'noicon.example',
    ]);
  });

  it('are wanted again at once where a wider search may find what a narrower one did not', () => {
    const without = aCardWith([aField(URL_SPEC, ['https://noicon.example'])]);
    const document = setSiteIcon(aDocument([without]), 'noicon.example', {
      kind: 'none',
      at: anHlc(1000),
      reach: 1,
    });

    expect({
      wider: siteIconsWanted(document, 2000, 2),
      same: siteIconsWanted(document, 2000, 1),
    }).toEqual({ wider: ['noicon.example'], same: [] });
  });

  it('read a "none" written before searches had a reach as the narrowest one', () => {
    const without = setSiteIcon(aDocument(), 'github.com', {
      kind: 'none',
      at: anHlc(1),
      reach: 1,
    });
    const entries = new Map(encodeDocument(without).map(entry => [entry.path, entry.bytes]));
    const listed = JSON.parse(new TextDecoder().decode(entries.get('icons.json'))) as object[];
    entries.set(
      'icons.json',
      new TextEncoder().encode(
        JSON.stringify(listed.map(({ reach: _reach, ...old }: { reach?: number }) => old))
      )
    );

    const decoded = decodeDocument(entries);

    expect(decoded.ok && decoded.value.siteIcons.get('github.com')).toEqual({
      kind: 'none',
      at: anHlc(1),
      reach: 1,
    });
  });

  it('travel in the vault file and merge by the later stamp', () => {
    const withIcon = setSiteIcon(aDocument(), 'github.com', {
      kind: 'icon',
      png: PNG,
      at: anHlc(2),
    });
    const without = setSiteIcon(aDocument(), 'github.com', {
      kind: 'none',
      at: anHlc(1),
      reach: 2,
    });

    const decoded = decodeDocument(
      new Map(encodeDocument(withIcon).map(entry => [entry.path, entry.bytes]))
    );

    expect(decoded.ok && decoded.value.siteIcons).toEqual(withIcon.siteIcons);
    expect(mergeDocument(without, withIcon).siteIcons.get('github.com')?.kind).toBe('icon');
    expect(mergeDocument(withIcon, without).siteIcons.get('github.com')?.kind).toBe('icon');
  });
});
