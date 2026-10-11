import type { TCardId, TGroupId } from '@frozik/vault/model/ids';
import type { TVaultKey } from '@frozik/vault/persistence/ports';

import type { TVaultSection } from './vault-paths';
import { parseVaultPage, vaultPaths } from './vault-paths';

const VAULT = '0a1b2c3d4e5f60718293a4b5c6d7e8f9' as TVaultKey;
const CARD = '6f9619ff-8b86-4011-b42d-00c04fc964ff' as TCardId;
const GROUP = '1b4e28ba-2fa1-41d2-883f-0016d3cca427' as TGroupId;
const FAVORITES: TVaultSection = 'favorites';
const WORK: TVaultSection = GROUP;

function splatOf(path: string): string {
  return path.slice(vaultPaths.vault(VAULT).length + 1);
}

describe('vaultPaths', () => {
  it('nests every page under its vault', () => {
    expect(vaultPaths.start()).toBe('/vault');
    expect(vaultPaths.vault(VAULT)).toBe(`/vault/${VAULT}`);
    expect(vaultPaths.card(VAULT, FAVORITES, CARD)).toBe(`/vault/${VAULT}/favorites/${CARD}`);
    expect(vaultPaths.history(VAULT, WORK, CARD)).toBe(`/vault/${VAULT}/${GROUP}/${CARD}/history`);
    expect(vaultPaths.settings(VAULT)).toBe(`/vault/${VAULT}/settings`);
  });

  it('reads back every page it builds', () => {
    expect(parseVaultPage(splatOf(vaultPaths.section(VAULT, WORK)))).toEqual({
      kind: 'section',
      section: WORK,
    });
    expect(parseVaultPage(splatOf(vaultPaths.card(VAULT, FAVORITES, CARD)))).toEqual({
      kind: 'card',
      section: FAVORITES,
      cardId: CARD,
    });
    expect(parseVaultPage(splatOf(vaultPaths.history(VAULT, WORK, CARD)))).toEqual({
      kind: 'history',
      section: WORK,
      cardId: CARD,
    });
    expect(parseVaultPage(splatOf(vaultPaths.audit(VAULT)))).toEqual({ kind: 'audit' });
  });

  it('opens all cards at the bare vault address', () => {
    expect(parseVaultPage('')).toEqual({ kind: 'section', section: 'all' });
  });

  it('reports an address it does not know instead of guessing', () => {
    expect(parseVaultPage(`all/${CARD}/edit`)).toEqual({ kind: 'unknown' });
    expect(parseVaultPage('settings/extra')).toEqual({ kind: 'unknown' });
    expect(parseVaultPage(`all/${CARD}/history/more`)).toEqual({ kind: 'unknown' });
  });
});
