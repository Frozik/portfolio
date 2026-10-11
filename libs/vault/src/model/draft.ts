import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';

import type { ICardState } from './card';
import type { TCombineAspect, TCombineChoices } from './card-combine';
import { combineCardChanges, combineClashes } from './card-combine';
import type { TCardChange } from './card-diff';
import { diffCardStates } from './card-diff';
import { putCard } from './card-edits';
import { descendsFrom, threeWayBase } from './card-versions';
import type { IHlc } from './hlc';
import { compareHlc } from './hlc';
import { cardState, commitCard } from './revision-edits';
import type { IVaultDocument } from './vault-document';

/** An edit in progress: a new card, or a card and the version the edit started from. */
export type TCardDraft =
  | { readonly kind: 'new'; readonly card: ICardState }
  | { readonly kind: 'edit'; readonly base: ICardState; readonly card: ICardState };

/** What the dialog shows when the card moved on while it was being edited. */
export type TDraftConflict =
  | { readonly kind: 'none' }
  | { readonly kind: 'deleted-elsewhere' }
  | {
      readonly kind: 'changed-elsewhere';
      readonly theirs: ICardState;
      /** 💬 What separates the fresher version from the draft, field by field. */
      readonly draftAgainstTheirs: readonly TCardChange[];
      /** The three-way view, from the newest version both descend from (none: every difference is a question). */
      readonly theirChanges: readonly TCardChange[];
      readonly myChanges: readonly TCardChange[];
      readonly clashes: readonly TCombineAspect[];
    };

export type TChangedElsewhere = Extract<TDraftConflict, { readonly kind: 'changed-elsewhere' }>;

export type TDraftResolution =
  | { readonly kind: 'keep-mine' }
  | { readonly kind: 'take-theirs' }
  | { readonly kind: 'combine'; readonly choices: TCombineChoices };

export type TDraftOutcome =
  | 'saved'
  | 'restored'
  | 'saved-over-theirs'
  | 'combined'
  | 'discarded'
  | 'needs-resolution';

export interface IDraftSaved {
  readonly document: IVaultDocument;
  readonly outcome: TDraftOutcome;
}

export function draftConflict(document: IVaultDocument, draft: TCardDraft): TDraftConflict {
  if (draft.kind === 'new') {
    return { kind: 'none' };
  }
  const current = document.cards.get(draft.base.id);
  if (isNil(current)) {
    return { kind: 'deleted-elsewhere' };
  }
  if (compareHlc(current.updatedAt, draft.base.updatedAt) === 0) {
    return { kind: 'none' };
  }
  const theirs = cardState(current);
  const base = threeWayBase(current, draft.base);
  return {
    kind: 'changed-elsewhere',
    theirs,
    draftAgainstTheirs: diffCardStates(theirs, draft.card),
    theirChanges: isNil(base) ? diffCardStates(draft.base, theirs) : diffCardStates(base, theirs),
    myChanges: isNil(base)
      ? diffCardStates(draft.base, draft.card)
      : diffCardStates(base, draft.card),
    clashes: combineClashes(base, theirs, draft.card),
  };
}

/**
 * Saving decides on the document as it is
 * now. A card changed elsewhere meanwhile is not overwritten silently: without
 * a resolution nothing is saved and the caller shows the dialog; with one,
 * the result is a new version whose ancestors include the fresher one, so no
 * device sees a conflict afterwards. A card deleted elsewhere comes back,
 * without the versions from before the deletion.
 */
export function saveDraft(
  document: IVaultDocument,
  draft: TCardDraft,
  at: IHlc,
  resolution?: TDraftResolution
): IDraftSaved {
  const mine = { ...draft.card, trashedAt: null };
  if (draft.kind === 'new') {
    return {
      document: putCard(document, {
        ...mine,
        createdAt: at,
        updatedAt: at,
        ancestors: [],
        history: [],
      }),
      outcome: 'saved',
    };
  }
  const current = document.cards.get(draft.base.id);
  if (isNil(current)) {
    return {
      document: putCard(document, { ...mine, updatedAt: at, ancestors: [], history: [] }),
      outcome: 'restored',
    };
  }
  const wasTrashed = !isNil(current.trashedAt);
  if (compareHlc(current.updatedAt, draft.base.updatedAt) === 0) {
    return {
      document: putCard(document, commitCard(current, mine, at)),
      outcome: wasTrashed ? 'restored' : 'saved',
    };
  }
  if (isNil(resolution)) {
    return { document, outcome: 'needs-resolution' };
  }
  /** The draft's line of versions lost a concurrent merge: the resolution takes it in, or the card would stay flagged. */
  const merging = descendsFrom(current, draft.base.updatedAt)
    ? []
    : [draft.base.updatedAt, ...draft.base.ancestors];
  const resolve = (content: ICardState, outcome: TDraftOutcome): IDraftSaved => ({
    document: putCard(document, commitCard(current, content, at, { keepPrevious: true, merging })),
    outcome,
  });
  switch (resolution.kind) {
    case 'take-theirs':
      return merging.length === 0
        ? { document, outcome: 'discarded' }
        : resolve(cardState(current), 'discarded');
    case 'keep-mine':
      return resolve(mine, 'saved-over-theirs');
    case 'combine':
      return resolve(
        combineCardChanges(
          threeWayBase(current, draft.base),
          cardState(current),
          draft.card,
          resolution.choices
        ),
        'combined'
      );
    default:
      return assertNever(resolution);
  }
}
