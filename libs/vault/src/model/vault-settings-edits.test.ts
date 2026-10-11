import { mergeDocument } from '../merge/merge-document';
import { aDocument, anHlc } from '../testing/builders';
import { renameVault } from './vault-settings-edits';

describe('renameVault', () => {
  it('renames the vault, and the later rename wins on every device', () => {
    const home = aDocument();
    const here = renameVault(home, 'Family', anHlc(5, 'device-a:1'));
    const there = renameVault(home, 'Household', anHlc(7, 'device-b:1'));

    expect(mergeDocument(here, there).settings.name).toBe('Household');
    expect(mergeDocument(there, here).settings.name).toBe('Household');
  });

  it('keeps the document when the name is empty or the same', () => {
    const home = aDocument();

    expect(renameVault(home, '  ', anHlc(5))).toBe(home);
    expect(renameVault(home, home.settings.name, anHlc(5))).toBe(home);
  });
});
