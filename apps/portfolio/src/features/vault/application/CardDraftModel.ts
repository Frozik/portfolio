import type { TResult } from '@frozik/utils/result/result';
import type { ICardState, TFieldKind } from '@frozik/vault/model/card';
import { allFields } from '@frozik/vault/model/card';
import type {
  TCardDraft,
  TChangedElsewhere,
  TDraftConflict,
  TDraftOutcome,
  TDraftResolution,
} from '@frozik/vault/model/draft';
import { draftConflict } from '@frozik/vault/model/draft';
import type { IDraftChanges } from '@frozik/vault/model/draft-changes';
import { draftChanges } from '@frozik/vault/model/draft-changes';
import { addField, setTypedFieldValue } from '@frozik/vault/model/field-edits';
import type { TAssetId, TFieldId, TTabId } from '@frozik/vault/model/ids';
import type { IVaultDocument } from '@frozik/vault/model/vault-document';
import type { IRandom } from '@frozik/vault/ports/random';
import type { IDraftRecord } from '@frozik/vault/session/draft-record';
import { isEqual, isNil } from 'lodash-es';
import { makeAutoObservable, observableRef, runInAction } from 'mobx';

import type { INewFile, TAttachRefusal } from '../domain/new-file';
import type { ISessionClock } from '../domain/ports/session-clock';

/** A file field's ids changed; a single-file field keeps the last one. */
function withFiles(
  card: ICardState,
  fieldId: TFieldId,
  change: (ids: readonly string[]) => readonly string[]
): ICardState {
  const field = allFields(card).find(candidate => candidate.id === fieldId);
  if (isNil(field)) {
    return card;
  }
  const current =
    field.value.cardinality === 'single' ? [field.value.value].filter(Boolean) : field.value.values;
  const next = change(current);
  return setTypedFieldValue(
    card,
    fieldId,
    field.value.cardinality === 'single'
      ? { cardinality: 'single', value: next.at(-1) ?? '' }
      : { cardinality: 'list', values: next }
  );
}

/** Typing pauses this long before the draft is sealed into the device store. */
export const DRAFT_SAVE_DEBOUNCE_MS = 500;

/**
 * One card being created or edited. The draft lives
 * apart from the document until "Save", is sealed into the device store as
 * it changes, and watches the document: a change made elsewhere meanwhile
 * shows as a banner, and saving over it asks how to resolve it.
 */
export class CardDraftModel {
  draft: TCardDraft;
  /** Set when "Save" found the card changed elsewhere and needs the user's choice. */
  pendingConflict: TChangedElsewhere | null = null;

  private cancelPersist: (() => void) | null = null;
  private frozen = false;

  constructor(
    draft: TCardDraft,
    private readonly dependencies: {
      readonly document: () => IVaultDocument;
      readonly record: IDraftRecord;
      readonly clock: ISessionClock;
      readonly random: IRandom;
      readonly save: (draft: TCardDraft, resolution?: TDraftResolution) => TDraftOutcome;
      readonly attach: (file: INewFile) => Promise<TResult<TAssetId, TAttachRefusal>>;
    }
  ) {
    this.draft = draft;
    makeAutoObservable<CardDraftModel, 'dependencies' | 'cancelPersist' | 'frozen'>(
      this,
      {
        draft: observableRef,
        pendingConflict: observableRef,
        dependencies: false,
        cancelPersist: false,
        frozen: false,
      },
      { autoBind: true }
    );
  }

  get card(): ICardState {
    return this.draft.card;
  }

  /** What the edit has changed so far: the editor marks those fields, and the title. */
  get changes(): IDraftChanges {
    return draftChanges(this.draft);
  }

  get dirty(): boolean {
    return this.draft.kind === 'new' || !isEqual(this.draft.base, this.draft.card);
  }

  /** The banner while editing: the card changed or disappeared on another device. */
  get remote(): TDraftConflict {
    return draftConflict(this.dependencies.document(), this.draft);
  }

  change(edit: (card: ICardState) => ICardState): void {
    this.draft = { ...this.draft, card: edit(this.draft.card) };
    if (this.frozen) {
      return;
    }
    this.cancelPersist?.();
    this.cancelPersist = this.dependencies.clock.after(DRAFT_SAVE_DEBOUNCE_MS, () => {
      this.cancelPersist = null;
      void this.dependencies.record.save(this.draft);
    });
  }

  /** A new field of any kind at the end of the tab; its id needs the session's randomness. */
  addField(tabId: TTabId, kind: TFieldKind, label: string, cardinality: 'single' | 'list'): void {
    this.change(
      card => addField(card, tabId, { kind, label, cardinality }, this.dependencies.random).card
    );
  }

  /** Files picked for a file field join the vault; the reasons any were refused come back. */
  async attachFiles(
    fieldId: TFieldId,
    files: readonly INewFile[]
  ): Promise<readonly TAttachRefusal[]> {
    const results = [];
    for (const file of files) {
      results.push(await this.dependencies.attach(file));
    }
    const added = results.flatMap(result => (result.ok ? [result.value] : []));
    if (added.length > 0) {
      runInAction(() =>
        this.change(card => withFiles(card, fieldId, current => [...current, ...added]))
      );
    }
    return results.flatMap(result => (result.ok ? [] : [result.error]));
  }

  detachFile(fieldId: TFieldId, assetId: TAssetId): void {
    this.change(card => withFiles(card, fieldId, current => current.filter(id => id !== assetId)));
  }

  /** `true` once the card is in the document; `false` while the user still has to choose. */
  save(resolution?: TDraftResolution): boolean {
    const outcome = this.dependencies.save(this.draft, resolution);
    if (outcome === 'needs-resolution') {
      const { remote } = this;
      this.pendingConflict = remote.kind === 'changed-elsewhere' ? remote : null;
      return false;
    }
    this.pendingConflict = null;
    this.forget();
    return true;
  }

  dismissConflict(): void {
    this.pendingConflict = null;
  }

  discard(): void {
    this.forget();
  }

  /** The lock writes a pending draft before the page reloads; `null` when nothing waits. */
  flush(): Promise<unknown> | null {
    if (this.cancelPersist === null) {
      return null;
    }
    this.cancelPersist();
    this.cancelPersist = null;
    return this.dependencies.record.save(this.draft);
  }

  freeze(): void {
    this.frozen = true;
    this.dispose();
  }

  dispose(): void {
    this.cancelPersist?.();
    this.cancelPersist = null;
  }

  private forget(): void {
    this.dispose();
    void this.dependencies.record.clear();
  }
}
