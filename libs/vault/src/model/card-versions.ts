import { isNil } from 'lodash-es';

import type { ICardRevision, ICardState, IVaultCard } from './card';
import { MAX_CARD_ANCESTORS } from './card';
import type { TCombineChoices } from './card-combine';
import { combineCardChanges } from './card-combine';
import type { IHlc } from './hlc';
import { compareHlc } from './hlc';
import { cardState, commitCard } from './revision-edits';

function isAmong(stamp: IHlc, stamps: readonly IHlc[]): boolean {
  return stamps.some(candidate => compareHlc(candidate, stamp) === 0);
}

/**
 * Below the oldest ancestor of a full list nothing can be told: a version
 * there may be an ancestor that fell off the list.
 */
function isKnowable(stamp: IHlc, ancestors: readonly IHlc[]): boolean {
  const oldest = ancestors.at(-1);
  return ancestors.length < MAX_CARD_ANCESTORS || isNil(oldest) || compareHlc(stamp, oldest) > 0;
}

/**
 * Versions in the card's history that are not among the
 * current one's ancestors: edits made at the same time elsewhere, which the
 * merge kept but nobody has decided about. Of a concurrent branch only its
 * newest version is listed: the older ones it superseded are its own past.
 */
export function concurrentVersions(card: IVaultCard): readonly ICardRevision[] {
  const unseen = card.history.filter(
    revision => !isAmong(revision.at, card.ancestors) && isKnowable(revision.at, card.ancestors)
  );
  return unseen.filter(
    revision =>
      !unseen.some(other => other !== revision && isAmong(revision.at, other.snapshot.ancestors))
  );
}

/**
 * What to do with one version made concurrently with the
 * current one: the decision settles that version only, so another one made
 * elsewhere at the same time is still shown and asked about.
 */
export type TConcurrentResolution =
  | { readonly kind: 'keep-current'; readonly version: IHlc }
  | { readonly kind: 'take'; readonly version: IHlc }
  /** `choices`: `theirs` is the current version (the fresher, the default), `mine` the chosen concurrent one. */
  | { readonly kind: 'combine'; readonly version: IHlc; readonly choices: TCombineChoices };

/** Whether a version is among the current one's ancestors — the current version itself counts too. */
export function descendsFrom(card: ICardState, version: IHlc): boolean {
  return compareHlc(card.updatedAt, version) === 0 || isAmong(version, card.ancestors);
}

/**
 * The base of a three-way combination of the card and another
 * version of it: that version itself when the card descends from it, else
 * the newest version in history both descend from; `null` when none is left.
 */
export function threeWayBase(card: IVaultCard, other: ICardState): ICardState | null {
  if (descendsFrom(card, other.updatedAt)) {
    return other;
  }
  return (
    card.history.find(
      revision => isAmong(revision.at, card.ancestors) && isAmong(revision.at, other.ancestors)
    )?.snapshot ?? null
  );
}

/**
 * One new version takes the decided concurrent one and its
 * ancestors in, so that conflict is gone on every device after sync. Its
 * content is the current version, the chosen one, or the two combined (from
 * their nearest common ancestor; with none left in history, every difference
 * is the user's choice).
 */
export function resolveConcurrentVersions(
  card: IVaultCard,
  resolution: TConcurrentResolution,
  at: IHlc
): IVaultCard {
  const chosen = concurrentVersions(card).find(
    revision => compareHlc(revision.at, resolution.version) === 0
  );
  if (isNil(chosen)) {
    return card;
  }
  const merging = [chosen.at, ...chosen.snapshot.ancestors];
  const current = cardState(card);
  if (resolution.kind === 'keep-current') {
    return commitCard(card, current, at, { merging });
  }
  const content =
    resolution.kind === 'take'
      ? { ...chosen.snapshot, id: card.id, createdAt: card.createdAt }
      : combineCardChanges(
          threeWayBase(card, chosen.snapshot),
          current,
          chosen.snapshot,
          resolution.choices
        );
  return commitCard(card, content, at, { merging });
}
