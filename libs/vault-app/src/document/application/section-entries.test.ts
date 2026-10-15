import type { TGroupId } from '@frozik/vault/model/ids';

import type { TVaultSection } from '../../navigation/vault-pages';
import { sectionEntriesOf } from './section-entries';

const WORK = 'work' as TGroupId;
const HOME = 'home' as TGroupId;

function group(id: TGroupId, name: string, order: number) {
  return { id, name, order };
}

describe('the sections of a list', () => {
  it('keep the always-wanted groups, drop empty built-in ones, then the user’s groups in order', () => {
    const counts = new Map<TVaultSection, number>([
      ['all', 3],
      ['with-otp', 1],
      [WORK, 2],
    ]);

    const entries = sectionEntriesOf({
      countOf: section => counts.get(section) ?? 0,
      smartGroups: [],
      groups: [group(WORK, 'Work', 2), group(HOME, 'Home', 1)],
    });

    expect(entries.map(entry => [entry.section, entry.count])).toEqual([
      ['all', 3],
      ['favorites', 0],
      ['with-otp', 1],
      ['archive', 0],
      ['trash', 0],
      [HOME, 0],
      [WORK, 2],
    ]);
  });
});
