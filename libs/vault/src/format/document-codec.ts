import { parseJson } from '@frozik/utils/parseJson';
import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';
import { isNil, omit } from 'lodash-es';
import type { z } from 'zod';

import type { TBytes } from '../crypto/bytes';
import { utf8, utf8Text } from '../crypto/bytes';
import type { ICardField, ICardState, ICardTab, IVaultCard, TFieldSpec } from '../model/card';
import type {
  TAssetId,
  TCardId,
  TFieldId,
  TGroupId,
  TLinkId,
  TTabId,
  TTemplateId,
} from '../model/ids';
import type { TSiteIcon } from '../model/site-icon';
import type {
  IAsset,
  ICardLink,
  IUserGroup,
  IUserSmartGroup,
  IUserTemplate,
  IVaultDocument,
  THotpCounterKey,
  TTombstoneKey,
} from '../model/vault-document';
import type { IContainerEntry } from './container';
import type { CARD_STATE_SCHEMA, FIELD_SCHEMA, TAB_SCHEMA } from './document-schema';
import {
  ASSETS_SCHEMA,
  CARD_SCHEMA,
  HOTP_COUNTERS_SCHEMA,
  SITE_ICONS_SCHEMA,
  KNOWN_FIELD_SPEC_SCHEMA,
  LINKS_SCHEMA,
  TOMBSTONES_SCHEMA,
  USER_SMART_GROUP_SCHEMA,
  USER_TEMPLATE_SCHEMA,
  VAULT_JSON_SCHEMA,
} from './document-schema';

/** The container layout. */
const VAULT_PATH = 'vault.json';
const LINKS_PATH = 'links.json';
const TOMBSTONES_PATH = 'tombstones.json';
const ASSETS_PATH = 'assets.json';
const HOTP_COUNTERS_PATH = 'hotp-counters.json';
const CARD_PATH = /^cards\/([^/]+)\.json$/;
const ASSET_PATH = /^assets\/([^/]+)$/;
const SITE_ICONS_PATH = 'icons.json';
const ICON_PATH = /^icons\/([^/]+)\.png$/;
/** Already compressed content is stored, not deflated again. */
const COMPRESSED_MIME = /^(image\/(?!svg)|video\/|audio\/|application\/(pdf|zip|gzip))/;

function readJson<Schema extends z.ZodType>(
  schema: Schema,
  bytes: TBytes | undefined
): z.infer<Schema> | null {
  const text = isNil(bytes) ? null : utf8Text(bytes);
  const parsed = schema.safeParse(parseJson<unknown>(text));
  return parsed.success ? parsed.data : null;
}

function readOptionalJson<Schema extends z.ZodType>(
  schema: Schema,
  entries: ReadonlyMap<string, TBytes>,
  path: string,
  empty: z.infer<Schema>
): z.infer<Schema> | null {
  return entries.has(path) ? readJson(schema, entries.get(path)) : empty;
}

/** Every item read, or nothing: one damaged entry fails the whole list. */
function collectAll<T>(items: readonly (T | null)[]): T[] | null {
  const collected: T[] = [];
  for (const item of items) {
    if (isNil(item)) {
      return null;
    }
    collected.push(item);
  }
  return collected;
}

/**
 * A field kind, or parameters of a known kind (a new bank-code
 * scheme), that this build does not read are kept as raw data and shown
 * read-only. The bytes are authenticated, so a mismatch is a newer writer,
 * never damage.
 */
function readFieldSpec(raw: z.infer<typeof FIELD_SCHEMA>['spec']): TFieldSpec {
  const known = KNOWN_FIELD_SPEC_SCHEMA.safeParse(raw);
  return known.success ? known.data : { kind: 'unknown', raw };
}

function readField(wire: z.infer<typeof FIELD_SCHEMA>): ICardField {
  return {
    id: wire.id as TFieldId,
    label: wire.label,
    spec: readFieldSpec(wire.spec),
    value: wire.value,
    sensitive: wire.sensitive,
    excludeFromAudit: wire.excludeFromAudit,
  };
}

function readTab(wire: z.infer<typeof TAB_SCHEMA>): ICardTab {
  return { id: wire.id as TTabId, title: wire.title, fields: wire.fields.map(readField) };
}

export function readCardState(wire: z.infer<typeof CARD_STATE_SCHEMA>): ICardState | null {
  const [firstTab, ...otherTabs] = wire.tabs.map(readTab);
  if (isNil(firstTab)) {
    return null;
  }
  return {
    id: wire.id as TCardId,
    title: wire.title,
    templateId: wire.templateId as TTemplateId,
    tabs: [firstTab, ...otherTabs],
    groupIds: wire.groupIds as TGroupId[],
    favorite: wire.favorite,
    color: wire.color,
    icon:
      wire.icon.kind === 'custom'
        ? { kind: 'custom', assetId: wire.icon.assetId as TAssetId }
        : wire.icon,
    protected: wire.protected,
    archivedAt: wire.archivedAt,
    trashedAt: wire.trashedAt,
    createdAt: wire.createdAt,
    updatedAt: wire.updatedAt,
    ancestors: wire.ancestors,
  };
}

function readCard(bytes: TBytes, expectedId: string): IVaultCard | null {
  const wire = readJson(CARD_SCHEMA, bytes);
  if (isNil(wire) || wire.id !== expectedId) {
    return null;
  }
  const state = readCardState(wire);
  const history = collectAll(
    wire.history.map(revision => {
      const snapshot = readCardState(revision.snapshot);
      return isNil(snapshot) ? null : { at: revision.at, snapshot };
    })
  );
  return isNil(state) || isNil(history) ? null : { ...state, history };
}

interface ISortedEntries {
  readonly cards: readonly (IVaultCard | null)[];
  readonly assetBytes: ReadonlyMap<TAssetId, TBytes>;
  readonly iconBytes: ReadonlyMap<string, TBytes>;
}

function sortEntries(entries: ReadonlyMap<string, TBytes>): ISortedEntries {
  const cards: (IVaultCard | null)[] = [];
  const assetBytes = new Map<TAssetId, TBytes>();
  const iconBytes = new Map<string, TBytes>();
  for (const [path, bytes] of entries) {
    const cardId = CARD_PATH.exec(path)?.[1];
    const assetId = ASSET_PATH.exec(path)?.[1];
    const iconDomain = ICON_PATH.exec(path)?.[1];
    if (!isNil(cardId)) {
      cards.push(readCard(bytes, cardId));
    } else if (!isNil(assetId)) {
      assetBytes.set(assetId as TAssetId, bytes);
    } else if (!isNil(iconDomain)) {
      iconBytes.set(iconDomain, bytes);
    }
  }
  return { cards, assetBytes, iconBytes };
}

/**
 * The container's files (manifest aside) into the
 * document; damage is `corrupted`. Files this build does not know are not
 * read: a vault that has them was written by a newer schema, and opens read-only.
 */
export function decodeDocument(
  entries: ReadonlyMap<string, TBytes>
): TResult<IVaultDocument, 'corrupted'> {
  const vault = readJson(VAULT_JSON_SCHEMA, entries.get(VAULT_PATH));
  const links = readOptionalJson(LINKS_SCHEMA, entries, LINKS_PATH, []);
  const tombstones = readOptionalJson(TOMBSTONES_SCHEMA, entries, TOMBSTONES_PATH, {});
  const assets = readOptionalJson(ASSETS_SCHEMA, entries, ASSETS_PATH, {});
  const hotpCounters = readOptionalJson(HOTP_COUNTERS_SCHEMA, entries, HOTP_COUNTERS_PATH, {});
  const siteIcons = readOptionalJson(SITE_ICONS_SCHEMA, entries, SITE_ICONS_PATH, []);
  const sorted = sortEntries(entries);
  const cards = collectAll(sorted.cards);
  if (
    isNil(vault) ||
    isNil(links) ||
    isNil(tombstones) ||
    isNil(assets) ||
    isNil(hotpCounters) ||
    isNil(siteIcons) ||
    isNil(cards)
  ) {
    return err('corrupted');
  }
  return ok({
    settings: {
      name: vault.name,
      expiryWarningDays: vault.settings.expiryWarningDays as Readonly<
        Partial<Record<TTemplateId, number>>
      >,
      providerHint: vault.providerHint,
      updatedAt: vault.settingsUpdatedAt,
    },
    cards: new Map(cards.map(card => [card.id, card])),
    groups: new Map(
      vault.groups.map((group): [TGroupId, IUserGroup] => [
        group.id as TGroupId,
        { ...group, id: group.id as TGroupId },
      ])
    ),
    templates: userTemplatesOf(vault.templates),
    smartGroups: new Map(
      vault.smartGroups.flatMap((entry): [TGroupId, IUserSmartGroup][] => {
        const parsed = USER_SMART_GROUP_SCHEMA.safeParse(entry);
        if (!parsed.success) {
          return [];
        }
        const id = parsed.data.id as TGroupId;
        return [[id, { ...parsed.data, id }]];
      })
    ),
    links: new Map(
      links.map((link): [TLinkId, ICardLink] => [
        link.id as TLinkId,
        {
          id: link.id as TLinkId,
          a: link.a as TCardId,
          b: link.b as TCardId,
          createdAt: link.createdAt,
        },
      ])
    ),
    tombstones: new Map(Object.entries(tombstones).map(([key, at]) => [key as TTombstoneKey, at])),
    assets: new Map(
      Object.values(assets).map((asset): [TAssetId, IAsset] => [
        asset.id as TAssetId,
        { ...asset, id: asset.id as TAssetId },
      ])
    ),
    assetBytes: sorted.assetBytes,
    siteIcons: siteIconsOf(siteIcons, sorted.iconBytes),
    hotpCounters: new Map(
      Object.entries(hotpCounters).map(([key, counter]) => [key as THotpCounterKey, counter])
    ),
  });
}

/**
 * The templates that read: a field's kind is written once, in
 * its spec; a template a newer version shaped differently is left out.
 */
function userTemplatesOf(raw: readonly unknown[]): ReadonlyMap<TTemplateId, IUserTemplate> {
  const templates = raw.flatMap(entry => {
    const parsed = USER_TEMPLATE_SCHEMA.safeParse(entry);
    if (!parsed.success) {
      return [];
    }
    const [first, ...others] = parsed.data.tabs.map(tab => ({
      title: tab.title,
      fields: tab.fields.map(field => ({ ...field, kind: field.spec.kind })),
    }));
    if (isNil(first)) {
      return [];
    }
    const template: IUserTemplate = {
      ...parsed.data,
      id: parsed.data.id as TTemplateId,
      tabs: [first, ...others],
    };
    return [template];
  });
  return new Map(templates.map(template => [template.id, template]));
}

/** An icon whose file is missing is no icon: it is asked for again. */
function siteIconsOf(
  listed: z.infer<typeof SITE_ICONS_SCHEMA>,
  iconBytes: ReadonlyMap<string, TBytes>
): ReadonlyMap<string, TSiteIcon> {
  return new Map(
    listed.flatMap(({ domain, kind, at }): [string, TSiteIcon][] => {
      if (kind === 'none') {
        return [[domain, { kind, at }]];
      }
      const png = iconBytes.get(domain);
      return isNil(png) ? [] : [[domain, { kind, png, at }]];
    })
  );
}

function cardJson(card: IVaultCard): unknown {
  const fieldSpec = (spec: TFieldSpec): unknown => (spec.kind === 'unknown' ? spec.raw : spec);
  const state = (snapshot: ICardState): Record<string, unknown> => ({
    ...snapshot,
    tabs: snapshot.tabs.map(tab => ({
      ...tab,
      fields: tab.fields.map(field => ({ ...field, spec: fieldSpec(field.spec) })),
    })),
  });
  return {
    ...state(card),
    history: card.history.map(revision => ({
      at: revision.at,
      snapshot: state(revision.snapshot),
    })),
  };
}

function jsonEntry(path: string, value: unknown): IContainerEntry {
  return { path, bytes: utf8(JSON.stringify(value)), compress: true };
}

/** The document as the container's files. */
export function encodeDocument(document: IVaultDocument): readonly IContainerEntry[] {
  const { settings } = document;
  return [
    jsonEntry(VAULT_PATH, {
      name: settings.name,
      settings: { expiryWarningDays: settings.expiryWarningDays },
      providerHint: settings.providerHint,
      settingsUpdatedAt: settings.updatedAt,
      groups: [...document.groups.values()],
      smartGroups: [...document.smartGroups.values()],
      templates: [...document.templates.values()].map(template => ({
        ...template,
        tabs: template.tabs.map(tab => ({
          ...tab,
          fields: tab.fields.map(field => omit(field, 'kind')),
        })),
      })),
    }),
    jsonEntry(LINKS_PATH, [...document.links.values()]),
    jsonEntry(TOMBSTONES_PATH, Object.fromEntries(document.tombstones)),
    jsonEntry(ASSETS_PATH, Object.fromEntries(document.assets)),
    jsonEntry(HOTP_COUNTERS_PATH, Object.fromEntries(document.hotpCounters)),
    jsonEntry(
      SITE_ICONS_PATH,
      [...document.siteIcons].map(([domain, icon]) => ({ domain, kind: icon.kind, at: icon.at }))
    ),
    ...[...document.siteIcons].flatMap(([domain, icon]) =>
      icon.kind === 'icon'
        ? [{ path: `icons/${domain}.png`, bytes: icon.png, compress: false }]
        : []
    ),
    ...[...document.cards.values()].map(card => jsonEntry(`cards/${card.id}.json`, cardJson(card))),
    ...[...document.assetBytes].map(([id, bytes]) => ({
      path: `assets/${id}`,
      bytes,
      compress: !COMPRESSED_MIME.test(document.assets.get(id)?.mime ?? ''),
    })),
  ];
}
