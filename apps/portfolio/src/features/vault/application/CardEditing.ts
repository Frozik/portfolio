import { assertNever } from '@frozik/utils/assert/assertNever';
import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';
import type { TBytes } from '@frozik/vault/crypto/bytes';
import {
  addAsset,
  addBlobAsset,
  assetPlacement,
  fileAssetIdsOf,
} from '@frozik/vault/model/asset-edits';
import type { INewAsset } from '@frozik/vault/model/asset-edits';
import { allFields } from '@frozik/vault/model/card';
import type { TTranslate } from '@frozik/vault/model/card-edits';
import { createCard } from '@frozik/vault/model/card-edits';
import type { TCardDraft, TDraftOutcome, TDraftResolution } from '@frozik/vault/model/draft';
import { saveDraft } from '@frozik/vault/model/draft';
import { normalizeCardValues } from '@frozik/vault/model/field-edits';
import type { IHlc } from '@frozik/vault/model/hlc';
import type { TAssetId, TCardId, TTemplateId } from '@frozik/vault/model/ids';
import { newAssetId } from '@frozik/vault/model/ids';
import { cardState } from '@frozik/vault/model/revision-edits';
import { createCardFromUserTemplate } from '@frozik/vault/model/template-edits';
import { templateOf } from '@frozik/vault/model/templates/registry';
import type { IVaultDocument } from '@frozik/vault/model/vault-document';
import type { IRandom } from '@frozik/vault/ports/random';
import type { IDraftRecord } from '@frozik/vault/session/draft-record';
import { fileHashOf } from '@frozik/vault/session/sync-effect-runner';
import { isNil, omit } from 'lodash-es';
import { makeAutoObservable, observableRef, runInAction } from 'mobx';

import type { INewFile, TAttachRefusal } from '../domain/new-file';
import type { IImageCompressor } from '../domain/ports/image-compressor';
import type { TReadQrCode } from '../domain/ports/qr-reader';
import type { ISessionClock } from '../domain/ports/session-clock';
import { CardDraftModel } from './CardDraftModel';
import type { TOtpScan } from './otp-scan';
import { scanOtp } from './otp-scan';
import type { TTransact } from './transact';

const FALLBACK_MIME = 'application/octet-stream';
const EXTENSION = /\.[^.]+$/;
const JPEG_EXTENSION = '.jpg';

/**
 * The card being created or edited, and the draft a
 * previous session left behind. Opening a draft never touches the document;
 * "Save" goes through the session's one write path.
 */
export class CardEditing {
  draft: CardDraftModel | null = null;
  /** A draft left by the last session, offered back: continue or discard. */
  offeredDraft: TCardDraft | null = null;

  constructor(
    private readonly dependencies: {
      readonly document: () => IVaultDocument;
      readonly readOnly: () => boolean;
      /** The session's latest stamp: a new card is made at it, and stamped again on save. */
      readonly stamp: () => IHlc;
      readonly transact: TTransact;
      readonly record: IDraftRecord;
      readonly clock: ISessionClock;
      readonly random: IRandom;
      readonly compressor: IImageCompressor;
      readonly readQrCode: TReadQrCode;
      /** Seals a file beside the vault; the key in hex, `null` when it was not written. */
      readonly storeBlob: (assetId: TAssetId, bytes: TBytes) => Promise<string | null>;
    }
  ) {
    makeAutoObservable<CardEditing, 'dependencies'>(
      this,
      { draft: observableRef, offeredDraft: observableRef, dependencies: false },
      { autoBind: true }
    );
  }

  /**
   * The device keeps one draft per vault. A dirty edit stays until saved or
   * cancelled, and a draft on offer from the last session waits for "continue"
   * or "discard": starting another edit would overwrite either unasked.
   */
  get canStart(): boolean {
    return this.isFree && isNil(this.offeredDraft);
  }

  private get isFree(): boolean {
    return !this.dependencies.readOnly() && !(this.draft?.dirty ?? false);
  }

  /** The files the open draft and the draft on offer hold: not orphans while they wait. */
  get heldFiles(): readonly TAssetId[] {
    return [this.draft?.card, this.offeredDraft?.card]
      .filter(card => !isNil(card))
      .flatMap(card => allFields(card).flatMap(fileAssetIdsOf));
  }

  startEditing(cardId: TCardId): void {
    const card = this.dependencies.document().cards.get(cardId);
    if (!this.canStart || isNil(card)) {
      return;
    }
    const state = cardState(card);
    this.open({ kind: 'edit', base: state, card: state });
  }

  /** From a built-in template in the reader's language, or from one of the user's own as written. */
  startCreating(templateId: TTemplateId, translate: TTranslate): TCardId | null {
    if (!this.canStart) {
      return null;
    }
    const { random } = this.dependencies;
    const at = this.dependencies.stamp();
    const own = this.dependencies.document().templates.get(templateId);
    const card = isNil(own)
      ? createCard(templateOf(templateId), { translate, random }, at)
      : createCardFromUserTemplate(own, random, at);
    this.open({ kind: 'new', card: cardState(card) });
    return card.id;
  }

  continueOffered(): void {
    const offered = this.offeredDraft;
    if (isNil(offered) || !this.isFree) {
      return;
    }
    this.offeredDraft = null;
    this.open(offered);
  }

  /** The device keeps one draft: once an editor is open its own draft holds the slot, and only the offer goes. */
  discardOffered(): void {
    this.offeredDraft = null;
    if (isNil(this.draft)) {
      void this.dependencies.record.clear();
    }
  }

  close(): void {
    this.draft?.discard();
    this.draft = null;
  }

  /** A one-time code from a picture of its QR code. */
  scanOtp(image: Parameters<TReadQrCode>[0]): Promise<TOtpScan> {
    return scanOtp(this.dependencies.readQrCode, image);
  }

  /**
   * A picked file joins the vault at once (a file
   * is immutable; one the draft never saves is collected as an orphan): a
   * photo compressed first, then kept in the container while it fits, sealed
   * beside it when it does not.
   */
  async attach(file: INewFile): Promise<TResult<TAssetId, TAttachRefusal>> {
    const compressed = await this.dependencies.compressor.compress(file.bytes, file.type);
    const bytes = compressed?.bytes ?? file.bytes;
    const asset = {
      name: isNil(compressed) ? file.name : file.name.replace(EXTENSION, '') + JPEG_EXTENSION,
      mime: compressed?.mime ?? (file.type === '' ? FALLBACK_MIME : file.type),
      bytes,
      sha256: await fileHashOf(bytes),
    };
    if (this.dependencies.readOnly()) {
      return err('read-only');
    }
    const placement = assetPlacement(this.dependencies.document(), bytes.byteLength);
    switch (placement) {
      case 'inline':
        return this.added(
          this.dependencies.transact((document, at) => {
            const result = addAsset(document, asset, at, this.dependencies.random);
            return { document: result.document, result: result.assetId };
          })
        );
      case 'blob':
        return this.attachBlob(asset);
      case 'too-large':
        return err('too-large');
      default:
        return assertNever(placement);
    }
  }

  /** The lock seals the pending draft before the page reloads; `null` when nothing waits. */
  flush(): Promise<unknown> | null {
    return this.draft?.flush() ?? null;
  }

  async offerLeftDraft(): Promise<void> {
    const left = await this.dependencies.record.load();
    runInAction(() => {
      this.offeredDraft = left;
    });
  }

  /** A rotation is sealing the vault: the draft is kept in memory, never saved under the old key. */
  freeze(): void {
    this.draft?.freeze();
  }

  dispose(): void {
    this.draft?.dispose();
  }

  private open(draft: TCardDraft): void {
    this.offeredDraft = null;
    this.draft?.dispose();
    this.draft = new CardDraftModel(draft, {
      document: this.dependencies.document,
      record: this.dependencies.record,
      clock: this.dependencies.clock,
      random: this.dependencies.random,
      save: this.save,
      attach: this.attach,
    });
  }

  private async attachBlob(asset: INewAsset): Promise<TResult<TAssetId, TAttachRefusal>> {
    const id = newAssetId(this.dependencies.random);
    const blobKey = await this.dependencies.storeBlob(id, asset.bytes);
    if (isNil(blobKey)) {
      return err('not-stored');
    }
    return this.added(
      this.dependencies.transact((document, at) => ({
        document: addBlobAsset(document, { ...omit(asset, 'bytes'), id, blobKey }, at),
        result: id,
      }))
    );
  }

  private added(assetId: TAssetId | null): TResult<TAssetId, TAttachRefusal> {
    return isNil(assetId) ? err('read-only') : ok(assetId);
  }

  /** A saved draft closes its edit here, not in the screen: the slot is free for the next one at once. */
  private save(draft: TCardDraft, resolution?: TDraftResolution): TDraftOutcome {
    const normalized = { ...draft, card: normalizeCardValues(draft.card) };
    const outcome =
      this.dependencies.transact((document, at) => {
        const saved = saveDraft(document, normalized, at, resolution);
        return { document: saved.document, result: saved.outcome };
      }) ?? 'needs-resolution';
    if (outcome !== 'needs-resolution') {
      this.draft = null;
    }
    return outcome;
  }
}
