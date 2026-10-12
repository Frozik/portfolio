import type { TCardId } from '@frozik/vault/model/ids';
import type { TGroupSelection } from '@frozik/vault/model/smart-groups';
import type { TVaultKey } from '@frozik/vault/persistence/ports';

/** The sidebar's selection: a built-in smart group, or a user group by its id. */
export type TVaultSection = TGroupSelection;

/** What the URL below `/vault/:vaultId` selects; the URL is its only owner. */
export type TVaultPage =
  | { readonly kind: 'section'; readonly section: TVaultSection }
  | { readonly kind: 'card'; readonly section: TVaultSection; readonly cardId: TCardId }
  | { readonly kind: 'history'; readonly section: TVaultSection; readonly cardId: TCardId }
  | { readonly kind: 'settings' }
  | { readonly kind: 'audit' }
  | { readonly kind: 'unknown' };

/** What the URL selects before a vault is open: the start, or one of the ways to get a vault. */
export type TStartPage = 'start' | 'create' | 'open-from-cloud' | 'create-in-cloud';

const ROOT = '/vault';
const NEW = 'new';
const OPEN = 'open';
const SETTINGS = 'settings';
const AUDIT = 'audit';
const HISTORY = 'history';
const ALL: TVaultSection = 'all';

function sectionSegment(section: TVaultSection): string {
  return encodeURIComponent(section);
}

/** A segment that names no built-in group is taken as a group id; one the vault lacks shows as "not found". */
function sectionOf(segment: string): TVaultSection {
  return segment as TVaultSection;
}

function vaultRoot(vaultKey: TVaultKey): string {
  return `${ROOT}/${encodeURIComponent(vaultKey)}`;
}

/** Every vault URL is built here; search text, titles and values never enter one. */
export const vaultPaths = {
  start: (): string => ROOT,
  create: (): string => `${ROOT}/${NEW}`,
  openFromCloud: (): string => `${ROOT}/${OPEN}`,
  /** A new vault in the cloud folder the opening reached. */
  createInCloud: (): string => `${ROOT}/${OPEN}/${NEW}`,
  vault: vaultRoot,
  section: (vaultKey: TVaultKey, section: TVaultSection): string =>
    `${vaultRoot(vaultKey)}/${sectionSegment(section)}`,
  card: (vaultKey: TVaultKey, section: TVaultSection, cardId: TCardId): string =>
    `${vaultRoot(vaultKey)}/${sectionSegment(section)}/${encodeURIComponent(cardId)}`,
  history: (vaultKey: TVaultKey, section: TVaultSection, cardId: TCardId): string =>
    `${vaultRoot(vaultKey)}/${sectionSegment(section)}/${encodeURIComponent(cardId)}/${HISTORY}`,
  settings: (vaultKey: TVaultKey): string => `${vaultRoot(vaultKey)}/${SETTINGS}`,
  audit: (vaultKey: TVaultKey): string => `${vaultRoot(vaultKey)}/${AUDIT}`,
};

/** Reads the router's decoded splat below `/vault/:vaultId`; a shape it does not know is `unknown`, never a redirect. */
export function parseVaultPage(splat: string): TVaultPage {
  const segments = splat.split('/').filter(segment => segment !== '');
  const [first, cardId, last, ...rest] = segments;
  if (rest.length > 0) {
    return { kind: 'unknown' };
  }
  if (first === undefined) {
    return { kind: 'section', section: ALL };
  }
  if (first === SETTINGS || first === AUDIT) {
    return segments.length === 1 ? { kind: first } : { kind: 'unknown' };
  }
  const section = sectionOf(first);
  if (cardId === undefined) {
    return { kind: 'section', section };
  }
  if (last === undefined) {
    return { kind: 'card', section, cardId: cardId as TCardId };
  }
  return last === HISTORY
    ? { kind: 'history', section, cardId: cardId as TCardId }
    : { kind: 'unknown' };
}

/** Reads a pathname below `/vault` that no vault owns; anything else is the start. */
export function parseStartPage(pathname: string): TStartPage {
  const segments = pathname.split('/').filter(segment => segment !== '');
  const [, first, second, ...rest] = segments;
  if (rest.length > 0) {
    return 'start';
  }
  if (first === NEW && second === undefined) {
    return 'create';
  }
  if (first !== OPEN) {
    return 'start';
  }
  if (second === undefined) {
    return 'open-from-cloud';
  }
  return second === NEW ? 'create-in-cloud' : 'start';
}
