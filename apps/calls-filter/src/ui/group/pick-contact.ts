import type { IContactMember } from '../../contexts/grouping/domain/member';
import type { TE164Digits } from '../../contexts/phone/domain/caller';
import type { TCountryCode } from '../../contexts/phone/domain/dialing-region';
import type { CallsFilterApp } from '../../contexts/shell/application/CallsFilterApp';

/** The system contact picker; the picked person becomes a member with the numbers they have now. */
export async function pickContactMember(app: CallsFilterApp): Promise<IContactMember | null> {
  const contact = await app.pickContact();
  if (contact === null) {
    return null;
  }
  const home = app.environment.home.country as TCountryCode;
  const numbers = contact.phones.flatMap((phone): TE164Digits[] => {
    const parsed = app.numbering.parse(phone, home);
    return parsed === null ? [] : [parsed];
  });
  const context = app.books.context();
  return {
    kind: 'contact',
    id: context.newMemberId(),
    displayName: contact.displayName === '' ? (numbers[0] ?? '') : contact.displayName,
    numbers,
    lookupKey: contact.id,
    updatedAt: context.now,
    excludedFor: null,
  };
}
