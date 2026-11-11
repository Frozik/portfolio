import { assert } from '@frozik/utils/assert/assert';

import { importSafeInCloud } from '../../import/safeincloud/map-safeincloud';
import { parseSafeInCloud } from '../../import/safeincloud/parse-safeincloud';
import { putCard } from '../../model/card-edits';
import { createGroup } from '../../model/group-edits';
import { emptyVaultDocument } from '../../model/vault-document';
import { aCardWith, aField, anHlc } from '../../testing/builders';
import { createSeededRandom } from '../../testing/seeded-random';
import { exportSafeInCloud } from './export-safeincloud';

const AT = anHlc(1000);
/** What XML must escape, the spaces it must keep, and lines. */
const AWKWARD = ' <b>&"quoted" \'single\'  \n second line ';

function vault() {
  const empty = emptyVaultDocument('Home', AT);
  const work = createGroup(empty, 'Work & play', AT, createSeededRandom(1));
  const account = aCardWith(
    [
      aField({ kind: 'login' }, 'jane'),
      aField({ kind: 'password', rotateEveryDays: null }, AWKWARD, { sensitive: true }),
      aField({ kind: 'url', match: 'host', useSharedCredentials: false }, [
        'https://one.example',
        'https://two.example',
      ]),
      aField({ kind: 'note' }, 'remember the PIN'),
    ],
    { title: 'Bank <main>', favorite: true, color: 'violet', groupIds: [work.groupId] }
  );
  const trashed = aCardWith([aField({ kind: 'login' }, 'gone')], {
    title: 'Trashed',
    trashedAt: AT,
  });
  return putCard(putCard(work.document, account), trashed);
}

describe('exporting to SafeInCloud', () => {
  it('reads back through SafeInCloud’s import as it was: fields, notes, label, star and colour', async () => {
    const database = parseSafeInCloud(exportSafeInCloud(vault()));
    assert(database !== null);

    const [card, ...rest] = (await importSafeInCloud(database)).cards;
    assert(card !== undefined);

    expect({
      cards: rest.length + 1,
      title: card.title,
      groups: card.groups,
      favorite: card.favorite,
      color: card.color,
      fields: card.tabs[0].fields.map(field => [
        field.spec.kind,
        field.value.cardinality === 'single' ? [field.value.value] : field.value.values,
      ]),
    }).toEqual({
      cards: 1,
      title: 'Bank <main>',
      groups: ['Work & play'],
      favorite: true,
      color: 'violet',
      fields: [
        ['login', ['jane']],
        ['password', [AWKWARD]],
        ['url', ['https://one.example']],
        ['url', ['https://two.example']],
        ['note', ['remember the PIN']],
      ],
    });
  });
});
