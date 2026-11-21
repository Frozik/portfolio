import type { TEditResult } from '../../contexts/grouping/application/GroupBookStore';
import { moveCaller } from '../../contexts/grouping/domain/caller-move';
import type { TGroupId } from '../../contexts/grouping/domain/group';
import type { IJournalEntry } from '../../contexts/journal/domain/journal-entry';
import type { CallsFilterApp } from '../../contexts/shell/application/CallsFilterApp';

/** «To group…» from a call of the journal: the exact mask, its note, and the exclusions it needs. */
export function moveEntry(
  app: CallsFilterApp,
  entry: IJournalEntry,
  target: TGroupId
): TEditResult {
  const note =
    entry.caller.contact?.displayName ??
    entry.caller.networkName ??
    entry.at.toString().slice(0, 10);
  return app.books.run((book, context) =>
    moveCaller(book, {
      caller: entry.caller,
      target,
      note,
      newMemberId: context.newMemberId,
      now: context.now,
      facts: context.facts,
    })
  );
}
