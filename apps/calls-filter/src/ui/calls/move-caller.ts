import { isNil } from 'lodash-es';

import type { TEditResult } from '../../contexts/grouping/application/GroupBookStore';
import { moveCaller } from '../../contexts/grouping/domain/caller-move';
import type { TGroupId } from '../../contexts/grouping/domain/group';
import type { IJournalEntry } from '../../contexts/journal/domain/journal-entry';
import type { ICaller } from '../../contexts/phone/domain/caller';
import type { CallsFilterApp } from '../../contexts/shell/application/CallsFilterApp';
import type { ITexts } from '../../texts/texts';
import { originText } from './origin-text';

/** A caller's pool offered for a move: its digits, and the words written beside its mask. */
export interface IPoolMove {
  readonly digits: string;
  readonly note: string;
}

/** The pool a stranger's number belongs to, when the catalogue names its operator; `null` otherwise. */
export function poolMoveOf(app: CallsFilterApp, texts: ITexts, caller: ICaller): IPoolMove | null {
  if (caller.contact !== null || caller.number === null) {
    return null;
  }
  const details = app.numberingCatalogue.detailsOf(caller.number);
  if (isNil(details?.operatorPool)) {
    return null;
  }
  return { digits: details.operatorPool, note: originText(texts, details) ?? '' };
}

/**
 * «To group…» from a call of the journal: the exact mask or the caller's whole pool, its note,
 * and the exclusions it needs.
 */
export function moveEntry(
  app: CallsFilterApp,
  entry: IJournalEntry,
  target: TGroupId,
  pool: IPoolMove | null = null
): TEditResult {
  const note =
    pool?.note ??
    entry.caller.contact?.displayName ??
    entry.caller.networkName ??
    entry.at.toString().slice(0, 10);
  return app.books.run((book, context) =>
    moveCaller(book, {
      caller: entry.caller,
      pool: pool?.digits ?? null,
      target,
      note,
      newMemberId: context.newMemberId,
      now: context.now,
      facts: context.facts,
    })
  );
}
