import type { ICaller } from '../../phone/domain/caller';
import { normalizeName } from '../../phone/domain/name-normalization';
import type { IContactMember } from './member';

/** A picked contact as the caller it stands for, to ask the groups whether they take it. */
export function pickedContactAsCaller(member: IContactMember): ICaller {
  return {
    number: member.numbers[0] ?? null,
    traits: null,
    networkName: null,
    contact: {
      lookupKey: member.lookupKey ?? member.id,
      displayName: member.displayName,
      name: normalizeName(member.displayName),
    },
  };
}
