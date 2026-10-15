import type { TTranslate } from '@frozik/vault/model/card-edits';
import type { IHlc } from '@frozik/vault/model/hlc';
import type { IVaultDocument } from '@frozik/vault/model/vault-document';

/** A vault with made-up cards, to try the app without one's own secrets. */
export interface IDemoSeed {
  /** The demo vault's password, shown on the screen. */
  readonly password: string;
  /** The edit that fills a new demo vault, its cards worded in the user's language. */
  cardsOf(texts: TTranslate): Promise<(document: IVaultDocument, at: IHlc) => IVaultDocument>;
}
