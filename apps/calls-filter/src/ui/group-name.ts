import type { TGroup } from '../contexts/grouping/domain/group';
import type { ITexts } from '../texts/texts';

/** What the user calls a group: its name, or the fixed names of the special two. */
export function groupName(texts: ITexts, group: TGroup): string {
  switch (group.kind) {
    case 'custom':
      return group.name;
    case 'my-contacts':
      return texts.groups.myContacts;
    case 'strangers':
      return texts.groups.strangers;
  }
}
