import { aCardWith, aField } from '../testing/builders';
import { createSeededRandom } from '../testing/seeded-random';
import { renameCard } from './card-edits';
import { draftChanges } from './draft-changes';
import { addField, setFieldValue } from './field-edits';
import { cardState } from './revision-edits';

const login = aField({ kind: 'login' }, 'jane', { label: 'Login' });
const note = aField({ kind: 'text' }, 'hello', { label: 'Note' });

describe('the changes of a draft', () => {
  it('marks the fields changed or added since the version the edit started from', () => {
    const base = cardState(aCardWith([login, note], { title: 'Mail' }));
    const edited = addField(
      setFieldValue(base, login.id, { cardinality: 'single', value: 'john' }),
      base.tabs[0].id,
      { kind: 'email', label: 'Email', cardinality: 'single' },
      createSeededRandom(1)
    );

    const changes = draftChanges({ kind: 'edit', base, card: edited.card });

    expect([...changes.fields].sort()).toEqual([login.id, edited.fieldId].sort());
    expect(changes.title).toBe(false);
  });

  it('marks a renamed title', () => {
    const base = cardState(aCardWith([note], { title: 'Mail' }));

    expect(draftChanges({ kind: 'edit', base, card: renameCard(base, 'Work mail') }).title).toBe(
      true
    );
  });

  it('marks what is filled in on a new card, the empty fields of its template not', () => {
    const empty = aField({ kind: 'password', rotateEveryDays: null }, '', { label: 'Password' });
    const card = cardState(aCardWith([login, empty], { title: '' }));

    const changes = draftChanges({ kind: 'new', card });

    expect([...changes.fields]).toEqual([login.id]);
    expect(changes.title).toBe(false);
  });
});
