import { Contact, ContactField } from 'expo-contacts';

import type { IContactsDirectory } from '../contexts/grouping/domain/ports/contacts-directory';
import type { ICaller } from '../contexts/phone/domain/caller';
import type { TCountryCode } from '../contexts/phone/domain/dialing-region';
import { normalizeName } from '../contexts/phone/domain/name-normalization';
import type { IPhoneNumbering } from '../contexts/phone/domain/ports/phone-numbering';

const FIELDS = [ContactField.FULL_NAME, ContactField.PHONES] as const;

/** The address book through the class-based `expo-contacts`; the ids are Android's contact `_ID`, as the service sees them. */
export function expoContactsDirectory(
  numbering: IPhoneNumbering,
  home: () => TCountryCode
): IContactsDirectory {
  return {
    async callers() {
      const contacts = await Contact.getAllDetails(FIELDS);
      return contacts.flatMap(contact =>
        (contact.phones ?? []).flatMap((phone): ICaller[] => {
          const number = phone.number === undefined ? null : numbering.parse(phone.number, home());
          if (number === null) {
            return [];
          }
          const displayName = contact.fullName ?? '';
          return [
            {
              number,
              traits: numbering.traits(number),
              networkName: null,
              contact: { lookupKey: contact.id, displayName, name: normalizeName(displayName) },
            },
          ];
        })
      );
    },
    async pick() {
      const picked = await Contact.presentPicker();
      if (picked === null) {
        return null;
      }
      const details = await picked.getDetails(FIELDS);
      return {
        id: picked.id,
        displayName: details.fullName ?? '',
        phones: (details.phones ?? []).flatMap(phone =>
          phone.number === undefined ? [] : [phone.number]
        ),
      };
    },
  };
}
