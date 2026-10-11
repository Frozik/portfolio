import type { TNonEmptyArray } from '@frozik/utils/types/base';

import type { TBytes } from '../crypto/bytes';
import type { TCardColor, TCardIconRef, TFieldSpec, TFieldValue } from '../model/card';
import type { TTemplateId } from '../model/ids';
import type { IAsset } from '../model/vault-document';

/** A built-in label is a translation key, resolved in the language the import runs in; a source's own label is kept as text. */
export type TImportLabel =
  | { readonly kind: 'key'; readonly key: string }
  | { readonly kind: 'text'; readonly text: string };

export interface IImportedField {
  readonly label: TImportLabel;
  readonly spec: TFieldSpec;
  readonly value: TFieldValue;
  readonly sensitive: boolean;
  /** How far a HOTP field has counted in the vault it comes from. */
  readonly hotpCounter: number | null;
}

export interface IImportedTab {
  readonly title: TImportLabel | null;
  readonly fields: readonly IImportedField[];
}

/** A card as a source describes it, before it gets ids and stamps in this vault. */
export interface IImportedCard {
  readonly templateId: TTemplateId;
  readonly title: string;
  readonly tabs: TNonEmptyArray<IImportedTab>;
  /** Folders, collections, groups: matched to this vault's groups by name. */
  readonly groups: readonly string[];
  readonly favorite: boolean;
  readonly protected: boolean;
  readonly archived: boolean;
  readonly color: TCardColor | null;
  readonly icon: TCardIconRef;
  /** When the source says the entry was made (Firefox, Bitwarden). */
  readonly createdAtMs: number | null;
}

export type TImportSource =
  | 'chrome'
  | 'firefox'
  | 'safari'
  | 'bitwarden'
  | 'safeincloud'
  | 'cxf'
  | 'keepass'
  | 'authenticator'
  | 'pwv';

export type TImportWarning =
  /** Numbered as a spreadsheet numbers rows: the header is row 1. */
  | { readonly kind: 'row-skipped'; readonly row: number }
  | { readonly kind: 'field-dropped'; readonly card: string; readonly label: string }
  | { readonly kind: 'passkey-dropped'; readonly card: string }
  /** An attachment the source keeps inside its export; `name` is empty for a picture. */
  | { readonly kind: 'file-dropped'; readonly card: string; readonly name: string }
  | { readonly kind: 'item-skipped'; readonly title: string };

/** A file under the source's own id: it gets an id and a stamp of this vault when a card brings it in. */
export interface IImportedAsset {
  readonly asset: Pick<IAsset, 'id' | 'name' | 'mime' | 'sha256'>;
  readonly bytes: TBytes;
}

export interface IImportBatch {
  readonly source: TImportSource;
  readonly cards: readonly IImportedCard[];
  /** Pairs of positions in `cards`. */
  readonly links: readonly (readonly [number, number])[];
  readonly assets: readonly IImportedAsset[];
  readonly warnings: readonly TImportWarning[];
}

export function keyLabel(key: string): TImportLabel {
  return { kind: 'key', key };
}

export function textLabel(text: string): TImportLabel {
  return { kind: 'text', text };
}
