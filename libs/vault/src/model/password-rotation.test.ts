import { assert } from '@frozik/utils/assert/assert';

import { passwordsOf } from '../audit/audited-passwords';
import { exportCsv } from '../export/csv/export-csv';
import { aCardWith, aDocument, aField } from '../testing/builders';
import type { ICardField, ICardState, IVaultCard } from './card';
import { allFields, passwordRotationOf } from './card';
import { rotatePasswords, setFieldCardinality } from './field-edits';

const PASSWORD_SPEC = { kind: 'password', rotateEveryDays: null } as const;

function onlyField(card: ICardState): ICardField {
  const [field] = allFields(card);
  assert(field !== undefined);
  return field;
}

function rotationCard(values: readonly string[]): IVaultCard {
  return aCardWith([aField(PASSWORD_SPEC, values, { label: 'Password' })], { title: 'Office' });
}

function turn(card: ICardState): ICardState {
  return rotatePasswords(card, onlyField(card).id);
}

describe('a password rotation', () => {
  it('starts from the password a field already has', () => {
    const single = aCardWith([aField(PASSWORD_SPEC, 'spring-1', { label: 'Password' })]);

    const rotation = setFieldCardinality(single, onlyField(single).id, 'list');

    expect(passwordRotationOf(onlyField(rotation))).toEqual({
      current: 'spring-1',
      previous: null,
      count: 1,
    });
  });

  it('brings the oldest password back on top, the one in use becoming the previous', () => {
    const turned = turn(rotationCard(['autumn-3', 'summer-2', 'spring-1']));

    expect(onlyField(turned).value).toEqual({
      cardinality: 'list',
      values: ['spring-1', 'autumn-3', 'summer-2'],
    });
    expect(passwordRotationOf(onlyField(turned))).toEqual({
      current: 'spring-1',
      previous: 'autumn-3',
      count: 3,
    });
    expect(passwordRotationOf(onlyField(turn(turn(turned))))).toEqual({
      current: 'autumn-3',
      previous: 'summer-2',
      count: 3,
    });
  });

  it('counts only the password in use for the audit and the export', () => {
    const card = rotationCard(['spring-1', 'summer-2']);

    expect(passwordsOf(card)).toEqual(['spring-1']);
    expect(exportCsv(aDocument([card]))).toContain('spring-1');
    expect(exportCsv(aDocument([card]))).not.toContain('summer-2');
  });
});
