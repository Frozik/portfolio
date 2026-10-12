import { mergeDocument } from '../merge/merge-document';
import { aDocument, anHlc } from '../testing/builders';
import { renameVault } from './vault-settings-edits';

describe('renameVault', () => {
  it('renames the vault, and the later rename wins on every device', () => {
    const home = aDocument();
    const here = renameVault(home, { name: 'Family', description: '' }, anHlc(5, 'device-a:1'));
    const there = renameVault(home, { name: 'Household', description: '' }, anHlc(7, 'device-b:1'));

    expect(mergeDocument(here, there).settings.name).toBe('Household');
    expect(mergeDocument(there, here).settings.name).toBe('Household');
  });

  it('describes the vault, trimmed, and clears the description when it is blank', () => {
    const home = aDocument();
    const described = renameVault(
      home,
      { name: home.settings.name, description: '  Shared with the family  ' },
      anHlc(5)
    );

    expect(described.settings.description).toBe('Shared with the family');
    expect(
      renameVault(described, { name: home.settings.name, description: ' ' }, anHlc(6)).settings
        .description
    ).toBe('');
  });

  it('keeps the document when the name is empty or nothing changes', () => {
    const home = aDocument();
    const { name, description } = home.settings;

    expect(renameVault(home, { name: '  ', description: 'Work' }, anHlc(5))).toBe(home);
    expect(renameVault(home, { name, description }, anHlc(5))).toBe(home);
  });
});
