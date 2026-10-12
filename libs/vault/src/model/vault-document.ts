import type { TNonEmptyArray } from '@frozik/utils/types/base';

import type { TBuiltinIcon } from './builtin-icons';
import type { IVaultCard, TCardColor, TFieldKind, TFieldSpec } from './card';
import type { IHlc } from './hlc';
import type { TAssetId, TCardId, TFieldId, TGroupId, TLinkId, TTemplateId } from './ids';
import type { TSiteIcon } from './site-icon';
import type { TSmartGroupRule } from './smart-group-rule';

export interface IUserGroup {
  readonly id: TGroupId;
  readonly name: string;
  readonly icon: TBuiltinIcon | null;
  readonly color: TCardColor | null;
  readonly order: number;
  readonly updatedAt: IHlc;
}

/** A smart group the user built: its members are whatever the rule matches, never stored. */
export interface IUserSmartGroup {
  readonly id: TGroupId;
  readonly name: string;
  readonly rule: TSmartGroupRule;
  readonly updatedAt: IHlc;
}

/** Undirected; the id is derived from the pair, so both devices name it alike. */
export interface ICardLink {
  readonly id: TLinkId;
  readonly a: TCardId;
  readonly b: TCardId;
  readonly createdAt: IHlc;
}

/** Immutable once added; a replacement is a new asset. */
export interface IAsset {
  readonly id: TAssetId;
  readonly name: string;
  readonly mime: string;
  readonly sha256: string;
  readonly storage: { readonly kind: 'inline' } | { readonly kind: 'blob'; readonly key: string };
  readonly orphanedAt: IHlc | null;
  readonly createdAt: IHlc;
}

export type TTombstoneKey =
  | `card:${TCardId}`
  | `link:${TLinkId}`
  | `group:${TGroupId}`
  | `template:${TTemplateId}`;

export type THotpCounterKey = `${TCardId}/${TFieldId}`;

/** Where the vault lives, synced as a hint only: never a password or a token. */
export interface IProviderHint {
  readonly kind: string;
  readonly url: string | null;
  readonly username: string | null;
}

/** A field of a user template: its own label, and the kind's parameters as the card had them. */
export interface IUserTemplateField {
  readonly kind: TFieldKind;
  readonly label: string;
  readonly cardinality: 'single' | 'list';
  readonly spec: TFieldSpec;
  readonly sensitive: boolean;
}

/** A template the user saved from a card: the user's own words, no translation keys. */
export interface IUserTemplate {
  readonly id: TTemplateId;
  readonly name: string;
  readonly icon: TBuiltinIcon;
  readonly tabs: TNonEmptyArray<{
    readonly title: string | null;
    readonly fields: readonly IUserTemplateField[];
  }>;
  readonly updatedAt: IHlc;
}

/** Vault-wide preferences, one last-writer-wins unit. */
export interface IVaultSettings {
  readonly name: string;
  /** A line or two about the vault, shown beside its name; empty when there is none. */
  readonly description: string;
  /** Days before expiry a card counts as "soon", per template; others use the default. */
  readonly expiryWarningDays: Readonly<Partial<Record<TTemplateId, number>>>;
  readonly providerHint: IProviderHint | null;
  readonly updatedAt: IHlc;
}

/**
 * The aggregate: every change goes through an edit
 * module and returns a new document; unchanged cards keep their identity,
 * which the per-card caches of the core rely on.
 */
export interface IVaultDocument {
  readonly settings: IVaultSettings;
  readonly cards: ReadonlyMap<TCardId, IVaultCard>;
  readonly groups: ReadonlyMap<TGroupId, IUserGroup>;
  /** The user's own templates, each a last-writer-wins unit like a group. */
  readonly templates: ReadonlyMap<TTemplateId, IUserTemplate>;
  /** Deleted ones leave a `group:` tombstone, as a group does. */
  readonly smartGroups: ReadonlyMap<TGroupId, IUserSmartGroup>;
  readonly links: ReadonlyMap<TLinkId, ICardLink>;
  readonly tombstones: ReadonlyMap<TTombstoneKey, IHlc>;
  readonly assets: ReadonlyMap<TAssetId, IAsset>;
  readonly assetBytes: ReadonlyMap<TAssetId, Uint8Array<ArrayBuffer>>;
  /** Sites' icons, once per domain. */
  readonly siteIcons: ReadonlyMap<string, TSiteIcon>;
  /** HOTP counters, one per (card, field), only ever raised: merged by maximum. */
  readonly hotpCounters: ReadonlyMap<THotpCounterKey, number>;
}

export const DEFAULT_EXPIRY_WARNING_DAYS = 30;

export function emptyVaultDocument(name: string, at: IHlc): IVaultDocument {
  return {
    settings: { name, description: '', expiryWarningDays: {}, providerHint: null, updatedAt: at },
    cards: new Map(),
    groups: new Map(),
    templates: new Map(),
    smartGroups: new Map(),
    links: new Map(),
    tombstones: new Map(),
    assets: new Map(),
    assetBytes: new Map(),
    siteIcons: new Map(),
    hotpCounters: new Map(),
  };
}
