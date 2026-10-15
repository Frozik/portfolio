import { compareStrings } from '@frozik/vault/model/compare-strings';
import type { TBuiltinGroupId } from '@frozik/vault/model/smart-groups';
import { BUILTIN_GROUP_IDS } from '@frozik/vault/model/smart-groups';
import type { IUserGroup, IUserSmartGroup } from '@frozik/vault/model/vault-document';

import type { TVaultSection } from '../../navigation/vault-pages';

/** A place in the list of sections: the built-in groups by id, the user's by name. */
export type TSectionEntry =
  | { readonly kind: 'builtin'; readonly section: TBuiltinGroupId; readonly count: number }
  | {
      readonly kind: 'smart' | 'group';
      readonly section: TVaultSection;
      readonly name: string;
      readonly count: number;
    };

/** Built-in groups shown even when empty: the ones a user looks for by name. */
const ALWAYS_SHOWN: ReadonlySet<TBuiltinGroupId> = new Set([
  'all',
  'favorites',
  'archive',
  'trash',
]);

/** All cards and the built-in groups that have members, then the user's smart groups and groups. */
export function sectionEntriesOf({
  countOf,
  smartGroups,
  groups,
}: {
  readonly countOf: (section: TVaultSection) => number;
  readonly smartGroups: readonly Pick<IUserSmartGroup, 'id' | 'name'>[];
  readonly groups: Iterable<Pick<IUserGroup, 'id' | 'name' | 'order'>>;
}): readonly TSectionEntry[] {
  const builtin = BUILTIN_GROUP_IDS.filter(
    section => ALWAYS_SHOWN.has(section) || countOf(section) > 0
  ).map(section => ({ kind: 'builtin' as const, section, count: countOf(section) }));
  const smart = smartGroups.map(group => ({
    kind: 'smart' as const,
    section: group.id,
    name: group.name,
    count: countOf(group.id),
  }));
  const user = [...groups]
    .sort((first, second) => first.order - second.order || compareStrings(first.name, second.name))
    .map(group => ({
      kind: 'group' as const,
      section: group.id,
      name: group.name,
      count: countOf(group.id),
    }));
  return [...builtin, ...smart, ...user];
}
