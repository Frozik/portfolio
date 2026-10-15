import type { TCardId } from '@frozik/vault/model/ids';
import type { TVaultKey } from '@frozik/vault/persistence/ports';

import type { TStartPage, TVaultPage, TVaultSection } from './vault-pages';

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

/**
 * Every vault address of a renderer whose vault pages live under `root`
 * (`/vault` in the portfolio, `''` at the root of the web app); search text,
 * titles and values never enter one.
 */
export function createVaultPaths(root: string) {
  const vaultRoot = (vaultKey: TVaultKey): string => `${root}/${encodeURIComponent(vaultKey)}`;
  return {
    start: (): string => (root === '' ? '/' : root),
    create: (): string => `${root}/${NEW}`,
    openFromCloud: (): string => `${root}/${OPEN}`,
    /** A new vault in the cloud folder the opening reached. */
    createInCloud: (): string => `${root}/${OPEN}/${NEW}`,
    vault: vaultRoot,
    section: (vaultKey: TVaultKey, section: TVaultSection): string =>
      `${vaultRoot(vaultKey)}/${sectionSegment(section)}`,
    card: (vaultKey: TVaultKey, section: TVaultSection, cardId: TCardId): string =>
      `${vaultRoot(vaultKey)}/${sectionSegment(section)}/${encodeURIComponent(cardId)}`,
    history: (vaultKey: TVaultKey, section: TVaultSection, cardId: TCardId): string =>
      `${vaultRoot(vaultKey)}/${sectionSegment(section)}/${encodeURIComponent(cardId)}/${HISTORY}`,
    settings: (vaultKey: TVaultKey): string => `${vaultRoot(vaultKey)}/${SETTINGS}`,
    audit: (vaultKey: TVaultKey): string => `${vaultRoot(vaultKey)}/${AUDIT}`,
    /** The path below the vault root, from a router path that starts with it. */
    belowRoot: (pathname: string): string =>
      pathname.startsWith(root) ? pathname.slice(root.length) : pathname,
  };
}

/** The addresses of one renderer's vault pages. */
export type TVaultPaths = ReturnType<typeof createVaultPaths>;

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

/** Reads the path below the vault's root that no vault owns; anything else is the start. */
export function parseStartPage(belowRoot: string): TStartPage {
  const segments = belowRoot.split('/').filter(segment => segment !== '');
  const [first, second, ...rest] = segments;
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
