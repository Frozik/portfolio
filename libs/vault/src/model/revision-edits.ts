import { isEqual, isNil, omit, uniqWith } from 'lodash-es';

import { canonicalJson } from './canonical-json';
import type { ICardField, ICardRevision, ICardState, IVaultCard } from './card';
import { allFields, MAX_CARD_ANCESTORS, MAX_CARD_HISTORY } from './card';
import { compareStrings } from './compare-strings';
import type { IHlc } from './hlc';
import { compareHlc } from './hlc';

/** Ordinary edits leave at most one snapshot per five minutes, or every letter of a note would. */
export const HISTORY_THROTTLE_MS = 5 * 60 * 1000;

export function cardState(card: IVaultCard): ICardState {
  return omit(card, 'history');
}

function sensitiveValues(card: ICardState): ReadonlyMap<string, ICardField['value']> {
  return new Map(
    allFields(card)
      .filter(field => field.sensitive)
      .map(field => [field.id, field.value])
  );
}

function touchesSecrets(previous: ICardState, next: ICardState): boolean {
  return !isEqual(sensitiveValues(previous), sensitiveValues(next));
}

function newestFirst(first: ICardRevision, second: ICardRevision): number {
  const byStamp = compareHlc(second.at, first.at);
  if (byStamp !== 0) {
    return byStamp;
  }
  return compareStrings(canonicalJson(first.snapshot), canonicalJson(second.snapshot));
}

/**
 * One entry per stamp, newest first, at most MAX_CARD_HISTORY.
 * Trimmed by count only, never by "now", and in a total order (a stamp tie
 * falls to the canonical JSON), so every device trims to the same list.
 */
export function trimHistory(history: readonly ICardRevision[]): readonly ICardRevision[] {
  const unique: ICardRevision[] = [];
  for (const revision of [...history].sort(newestFirst)) {
    if (unique.every(kept => compareHlc(kept.at, revision.at) !== 0)) {
      unique.push(revision);
    }
  }
  return unique.slice(0, MAX_CARD_HISTORY);
}

function isDue(card: IVaultCard, at: IHlc): boolean {
  const [latest] = card.history;
  return isNil(latest) || at.wallMs - latest.at.wallMs >= HISTORY_THROTTLE_MS;
}

export interface ICommitOptions {
  /** Ancestors a resolution takes in from the concurrent versions it settles. */
  readonly merging?: readonly IHlc[];
  /** Keep the previous version in history whatever the time rule says: a resolution leaves both sides inspectable. */
  readonly keepPrevious?: boolean;
}

/** Distinct stamps, newest first, capped: the order is total, so every device keeps the same list. */
export function boundedAncestors(stamps: readonly IHlc[]): readonly IHlc[] {
  return uniqWith(
    [...stamps].sort((first, second) => compareHlc(second, first)),
    (first, second) => compareHlc(first, second) === 0
  ).slice(0, MAX_CARD_ANCESTORS);
}

/**
 * Commits a change of a card: stamps it, keeps the previous version in
 * history when its history rule says so, and records the previous
 * version among the new one's ancestors. An unchanged card
 * comes back as the same object.
 */
export function commitCard(
  previous: IVaultCard,
  next: ICardState,
  at: IHlc,
  { merging = [], keepPrevious = false }: ICommitOptions = {}
): IVaultCard {
  const resolving = merging.length > 0 || keepPrevious;
  if (!resolving && isEqual(cardState(previous), next)) {
    return previous;
  }
  const kept = resolving || touchesSecrets(previous, next) || isDue(previous, at);
  const history = kept
    ? trimHistory([{ at: previous.updatedAt, snapshot: cardState(previous) }, ...previous.history])
    : previous.history;
  return {
    ...next,
    updatedAt: at,
    ancestors: boundedAncestors([previous.updatedAt, ...previous.ancestors, ...merging]),
    history,
  };
}

/**
 * Restoring is a new edit: the current version goes to history, nothing is
 * rewritten. The protection stays as it is now — taking it off needs the
 * master password, and an old version must not be a way around it.
 */
export function restoreRevision(card: IVaultCard, revisionAt: IHlc, at: IHlc): IVaultCard {
  const revision = card.history.find(entry => compareHlc(entry.at, revisionAt) === 0);
  if (isNil(revision)) {
    return card;
  }
  const restored: ICardState = {
    ...revision.snapshot,
    id: card.id,
    protected: card.protected,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
  };
  return {
    ...restored,
    updatedAt: at,
    ancestors: boundedAncestors([card.updatedAt, ...card.ancestors]),
    history: trimHistory([{ at: card.updatedAt, snapshot: cardState(card) }, ...card.history]),
  };
}
