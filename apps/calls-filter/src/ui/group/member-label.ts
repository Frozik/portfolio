import { assertNever } from '@frozik/utils/assert/assertNever';

import type { TMember } from '../../contexts/grouping/domain/member';
import type { ITexts } from '../../texts/texts';

export function memberLabel(texts: ITexts, member: TMember): string {
  switch (member.kind) {
    case 'number-mask':
      return member.mask.source;
    case 'name-mask':
      return `Aa «${member.mask.source}»`;
    case 'special':
      return texts.group.special[member.special];
    case 'contact':
      return `👤 ${member.displayName}`;
    default:
      return assertNever(member);
  }
}
