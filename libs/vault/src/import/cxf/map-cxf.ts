import { isNil, uniq } from 'lodash-es';

import type { TBytes } from '../../crypto/bytes';
import { fromBase64Url, toHex } from '../../crypto/bytes';
import { appearanceOf } from '../../format/cxf-appearance';
import type { TAssetId } from '../../model/ids';
import { BANK_CARD_TEMPLATE } from '../../model/templates/bank-card';
import { DOCUMENT_TEMPLATE } from '../../model/templates/document';
import { INTERNET_ACCOUNT_TEMPLATE } from '../../model/templates/internet-account';
import { NOTE_TEMPLATE } from '../../model/templates/note';
import { SERVER_TEMPLATE } from '../../model/templates/server';
import type { ICardTemplate } from '../../model/templates/template';
import { WIFI_TEMPLATE } from '../../model/templates/wifi';
import type {
  IImportBatch,
  IImportedAsset,
  IImportedCard,
  IImportedField,
  TImportWarning,
} from '../imported-card';
import { keyLabel } from '../imported-card';
import type { IFill } from '../template-card';
import { extraField, fill, plainCard, templateTabs } from '../template-card';
import type { ICxfPart } from './cxf-parts';
import { partsOf } from './cxf-parts';
import type { TCxfCollection, TCxfCredential, TCxfHeader, TCxfItem } from './cxf-schema';
import { isKnownCredential } from './cxf-schema';

const MS_PER_SECOND = 1000;
const FALLBACK_MIME = 'application/octet-stream';
const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  txt: 'text/plain',
};

/** The credential that names the card's template, in this order; a card of notes alone is a note. */
const TEMPLATE_OF: readonly (readonly [TCxfCredential['type'], ICardTemplate])[] = [
  ['credit-card', BANK_CARD_TEMPLATE],
  ['wifi', WIFI_TEMPLATE],
  ['passport', DOCUMENT_TEMPLATE],
  ['identity-document', DOCUMENT_TEMPLATE],
  ['ssh-key', SERVER_TEMPLATE],
  ['basic-auth', INTERNET_ACCOUNT_TEMPLATE],
  ['api-key', INTERNET_ACCOUNT_TEMPLATE],
];

function templateOf(credentials: readonly TCxfCredential[]): ICardTemplate {
  const found = TEMPLATE_OF.find(([type]) =>
    credentials.some(credential => credential.type === type)
  );
  return found?.[1] ?? NOTE_TEMPLATE;
}

function itemKey(account: string, item: string): string {
  return `${account}/${item}`;
}

/** Collection titles by the items they hold, nested collections included. */
function collectionsOf(
  account: string,
  collections: readonly TCxfCollection[],
  into = new Map<string, string[]>()
): ReadonlyMap<string, readonly string[]> {
  for (const collection of collections) {
    for (const linked of collection.items) {
      const key = itemKey(linked.account ?? account, linked.item);
      into.set(key, [...(into.get(key) ?? []), collection.title]);
    }
    collectionsOf(account, collection.subCollections ?? [], into);
  }
  return into;
}

function mimeOf(name: string): string {
  const extension = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
  return MIME_BY_EXTENSION[extension] ?? FALLBACK_MIME;
}

interface IItemRun {
  readonly warnings: TImportWarning[];
  readonly assets: Map<string, IImportedAsset>;
  readonly files: ReadonlyMap<string, TBytes>;
}

/** A template field takes the first part that names it; every other part is a field of its own. */
function cardContent(
  template: ICardTemplate,
  parts: readonly ICxfPart[]
): { readonly fills: Readonly<Record<string, IFill>>; readonly extras: readonly IImportedField[] } {
  const keys = new Set(template.tabs.flatMap(tab => tab.fields.map(field => field.labelKey)));
  const fills: Record<string, IFill> = {};
  const extras: IImportedField[] = [];
  for (const { fillKey, label, kind, value, spec } of parts) {
    if (!isNil(fillKey) && keys.has(fillKey) && isNil(fills[fillKey])) {
      fills[fillKey] = fill(value, spec);
    } else {
      extras.push(extraField(kind, label, value, spec));
    }
  }
  return { fills, extras };
}

function fileParts(
  run: IItemRun,
  item: TCxfItem,
  credentials: readonly TCxfCredential[]
): readonly ICxfPart[] {
  const ids = credentials.flatMap(credential => {
    if (credential.type !== 'file') {
      return [];
    }
    const bytes = run.files.get(credential.id);
    const hash = fromBase64Url(credential.integrityHash);
    if (isNil(bytes) || isNil(hash)) {
      run.warnings.push({ kind: 'file-dropped', card: item.title, name: credential.name });
      return [];
    }
    run.assets.set(credential.id, {
      asset: {
        id: credential.id as TAssetId,
        name: credential.name,
        mime: mimeOf(credential.name),
        sha256: toHex(hash),
      },
      bytes,
    });
    return [credential.id];
  });
  return ids.length === 0
    ? []
    : [{ fillKey: 'field.scans', label: keyLabel('field.files'), kind: 'file', value: ids }];
}

function cardOf(run: IItemRun, item: TCxfItem, groups: readonly string[]): IImportedCard {
  const credentials = item.credentials.filter(isKnownCredential);
  for (const credential of item.credentials) {
    if (!isKnownCredential(credential)) {
      run.warnings.push({ kind: 'field-dropped', card: item.title, label: credential.type });
    } else if (credential.type === 'passkey') {
      run.warnings.push({ kind: 'passkey-dropped', card: item.title });
    }
  }
  const parts = credentials.flatMap(credential => {
    const read = partsOf(credential, item.title);
    if (isNil(read)) {
      run.warnings.push({ kind: 'field-dropped', card: item.title, label: credential.type });
    }
    return read ?? [];
  });
  const urls = (item.scope?.urls ?? []).filter(url => url !== '');
  const template = templateOf(credentials);
  const { fills, extras } = cardContent(template, [
    ...(urls.length === 0
      ? []
      : [
          {
            fillKey: 'field.websites',
            label: keyLabel('field.websites'),
            kind: 'url' as const,
            value: urls,
          },
        ]),
    ...parts,
    ...fileParts(run, item, credentials),
  ]);
  const appearance = appearanceOf(item.extensions);
  return plainCard(template, item.title, templateTabs(template, fills, extras), {
    groups,
    favorite: item.favorite === true,
    color: appearance?.color ?? null,
    icon: isNil(appearance?.icon) ? { kind: 'auto' } : { kind: 'builtin', name: appearance.icon },
    protected: appearance?.protected ?? false,
    archived: appearance?.archived ?? false,
    createdAtMs: isNil(item.creationAt) ? null : item.creationAt * MS_PER_SECOND,
  });
}

/**
 * Every account's items as cards (the template from the
 * main credential, the rest as fields), collections and tags as groups,
 * item references as links, files from the archive beside `cxf.json`.
 * Passkeys and credential types this version does not know are reported.
 */
export function importCxf(header: TCxfHeader, files: ReadonlyMap<string, TBytes>): IImportBatch {
  const run: IItemRun = { warnings: [], assets: new Map(), files };
  const cards: IImportedCard[] = [];
  const positions = new Map<string, number>();
  const references: (readonly [number, string])[] = [];
  for (const account of header.accounts) {
    const collections = collectionsOf(account.id, account.collections ?? []);
    for (const item of account.items) {
      const key = itemKey(account.id, item.id);
      positions.set(key, cards.length);
      for (const credential of item.credentials.filter(isKnownCredential)) {
        if (credential.type === 'item-reference') {
          const { reference } = credential;
          references.push([cards.length, itemKey(reference.account ?? account.id, reference.item)]);
        }
      }
      cards.push(cardOf(run, item, uniq([...(collections.get(key) ?? []), ...(item.tags ?? [])])));
    }
  }
  const links = references.flatMap(([from, key]): (readonly [number, number])[] => {
    const to = positions.get(key);
    return isNil(to) || to === from ? [] : [[from, to]];
  });
  return { source: 'cxf', cards, links, assets: [...run.assets.values()], warnings: run.warnings };
}
