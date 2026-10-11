import { assert } from '@frozik/utils/assert/assert';

import { decodeDocument, encodeDocument } from '../format/document-codec';
import { mergeDocument } from '../merge/merge-document';
import { aCardWith, aDocument, aField, anHlc } from '../testing/builders';
import { createSeededRandom } from '../testing/seeded-random';
import { allFields, fieldValues } from './card';
import {
  createCardFromUserTemplate,
  deleteTemplate,
  renameTemplate,
  saveAsTemplate,
} from './template-edits';

const URL_SPEC = { kind: 'url', match: 'exact', useSharedCredentials: false } as const;

function aLockerCard() {
  return aCardWith(
    [
      aField({ kind: 'text' }, 'Locker 12', { label: 'Locker' }),
      aField(URL_SPEC, ['https://gym.example'], { label: 'Booking' }),
      aField({ kind: 'secret' }, '4711', { label: 'Combination', sensitive: false }),
    ],
    { icon: { kind: 'builtin', name: 'key' } }
  );
}

describe('user templates', () => {
  it('keep a card’s labels, kinds, parameters and secrecy, never its values', () => {
    const { document, templateId } = saveAsTemplate(
      aDocument(),
      aLockerCard(),
      ' Gym locker ',
      anHlc(2),
      createSeededRandom(1)
    );
    const template = document.templates.get(templateId);
    assert(template !== undefined);

    const card = createCardFromUserTemplate(template, createSeededRandom(2), anHlc(3));

    expect(template.name).toBe('Gym locker');
    expect(templateId.startsWith('user-')).toBe(true);
    expect(card.icon).toEqual({ kind: 'builtin', name: 'key' });
    expect(allFields(card).map(field => [field.label, field.spec, field.sensitive])).toEqual([
      ['Locker', { kind: 'text' }, false],
      ['Booking', URL_SPEC, false],
      ['Combination', { kind: 'secret' }, false],
    ]);
    expect(allFields(card).flatMap(fieldValues)).toEqual([]);
    expect(card.templateId).toBe(templateId);
  });

  it('are renamed and deleted, and a deletion stays deleted when another device merges in', () => {
    const saved = saveAsTemplate(
      aDocument(),
      aLockerCard(),
      'Gym',
      anHlc(2),
      createSeededRandom(1)
    );
    const renamed = renameTemplate(saved.document, saved.templateId, 'Gym locker', anHlc(3));
    const deleted = deleteTemplate(renamed, saved.templateId, anHlc(4));

    expect(renamed.templates.get(saved.templateId)?.name).toBe('Gym locker');
    expect(mergeDocument(deleted, renamed).templates.has(saved.templateId)).toBe(false);
    expect(mergeDocument(renamed, deleted).templates.has(saved.templateId)).toBe(false);
  });

  it('are written into the vault file and read back as they were', () => {
    const { document } = saveAsTemplate(
      aDocument(),
      aLockerCard(),
      'Gym',
      anHlc(2),
      createSeededRandom(1)
    );

    const decoded = decodeDocument(
      new Map(encodeDocument(document).map(entry => [entry.path, entry.bytes]))
    );

    expect(decoded.ok && decoded.value.templates).toEqual(document.templates);
  });
});
