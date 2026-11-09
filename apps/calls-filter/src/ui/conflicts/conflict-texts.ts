import { assertNever } from '@frozik/utils/assert/assertNever';

import type { IConflict } from '../../contexts/grouping/domain/conflict';
import type { TGroupId } from '../../contexts/grouping/domain/group';
import type { GroupBook } from '../../contexts/grouping/domain/group-book';
import { findGroup } from '../../contexts/grouping/domain/group-book';
import type { IPhoneNumbering } from '../../contexts/phone/domain/ports/phone-numbering';
import type { ITexts } from '../../texts/texts';
import { groupName } from '../group-name';

export function groupNames(texts: ITexts, book: GroupBook, ids: readonly TGroupId[]): string {
  return ids
    .map(id => findGroup(book, id))
    .flatMap(group => (group === null ? [] : [`«${groupName(texts, group)}»`]))
    .join(' · ');
}

export function exampleText(
  texts: ITexts,
  conflict: IConflict,
  numbering: IPhoneNumbering
): string {
  const { example } = conflict;
  switch (example.kind) {
    case 'number':
      return numbering.format(example.digits);
    case 'name':
      return `«${example.name}»`;
    case 'special':
      return `«${texts.group.special[example.special]}»`;
    case 'caller':
      return (
        example.caller.contact?.displayName ??
        (example.caller.number === null ? '' : numbering.format(example.caller.number))
      );
    default:
      return assertNever(example);
  }
}
