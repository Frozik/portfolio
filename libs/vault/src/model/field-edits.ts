import { replaceById } from '@frozik/utils/collections/edit-by-id';
import { isNonEmpty } from '@frozik/utils/collections/non-empty';
import { isNil } from 'lodash-es';

import type { IRandom } from '../ports/random';
import { allFields, fieldValues, isPasswordRotation } from './card';
import type { ICardField, ICardState, ICardTab, TFieldKind, TFieldSpec, TFieldValue } from './card';
import { FIELD_KINDS } from './field-kinds/registry';
import type { TFieldId, TTabId } from './ids';
import { newFieldId } from './ids';

function withTabs(card: ICardState, tabs: readonly ICardTab[]): ICardState {
  return isNonEmpty(tabs) ? { ...card, tabs } : card;
}

function tabOfField(card: ICardState, fieldId: TFieldId): ICardTab | undefined {
  return card.tabs.find(tab => tab.fields.some(field => field.id === fieldId));
}

function updateField(
  card: ICardState,
  fieldId: TFieldId,
  update: (field: ICardField) => ICardField
): ICardState {
  const tab = tabOfField(card, fieldId);
  if (isNil(tab)) {
    return card;
  }
  return withTabs(
    card,
    replaceById(card.tabs, tab.id, current => ({
      ...current,
      fields: replaceById(current.fields, fieldId, update),
    }))
  );
}

function normalizedValue(field: ICardField, value: TFieldValue, card: ICardState): TFieldValue {
  if (field.spec.kind === 'unknown') {
    return value;
  }
  const kind = FIELD_KINDS[field.spec.kind];
  const context = { spec: field.spec, card };
  return value.cardinality === 'single'
    ? { cardinality: 'single', value: kind.normalize(value.value, context) }
    : { cardinality: 'list', values: value.values.map(entry => kind.normalize(entry, context)) };
}

/**
 * Stores the value in its kind's canonical form. A field keeps
 * the cardinality it was made with, and a field of an unknown kind is read-only.
 */
export function setFieldValue(card: ICardState, fieldId: TFieldId, value: TFieldValue): ICardState {
  return updateField(card, fieldId, field =>
    field.spec.kind === 'unknown' || field.value.cardinality !== value.cardinality
      ? field
      : { ...field, value: normalizedValue(field, value, card) }
  );
}

/** One value into a list of it, or a list back to its first value; only for kinds that allow lists. */
export function setFieldCardinality(
  card: ICardState,
  fieldId: TFieldId,
  cardinality: TFieldValue['cardinality']
): ICardState {
  return updateField(card, fieldId, field => {
    if (
      field.spec.kind === 'unknown' ||
      field.value.cardinality === cardinality ||
      !FIELD_KINDS[field.spec.kind].listAllowed
    ) {
      return field;
    }
    const values = fieldValues(field);
    return {
      ...field,
      value:
        cardinality === 'list'
          ? { cardinality: 'list', values }
          : { cardinality: 'single', value: values[0] ?? '' },
    };
  });
}

/** The oldest password of a rotation comes back into use: it moves to the top, and the one in use becomes the previous. */
export function rotatePasswords(card: ICardState, fieldId: TFieldId): ICardState {
  return updateField(card, fieldId, field => {
    const values = fieldValues(field);
    const oldest = values.at(-1);
    return !isPasswordRotation(field) || oldest === undefined || values.length < 2
      ? field
      : { ...field, value: { cardinality: 'list', values: [oldest, ...values.slice(0, -1)] } };
  });
}

/** An editor's value as typed: the editor must not fight the user mid-word; `normalizeCardValues` runs on save. */
export function setTypedFieldValue(
  card: ICardState,
  fieldId: TFieldId,
  value: TFieldValue
): ICardState {
  return updateField(card, fieldId, field =>
    field.spec.kind === 'unknown' || field.value.cardinality !== value.cardinality
      ? field
      : { ...field, value }
  );
}

/** Every value in its kind's canonical form: what "Save" stores. */
export function normalizeCardValues(card: ICardState): ICardState {
  return allFields(card).reduce(
    (current, field) => setFieldValue(current, field.id, field.value),
    card
  );
}

export function renameField(card: ICardState, fieldId: TFieldId, label: string): ICardState {
  return updateField(card, fieldId, field => ({ ...field, label }));
}

/** The rule of a URL field, the options of a select, the scheme of a bank code — the kind itself never changes. */
export function setFieldSpec(card: ICardState, fieldId: TFieldId, spec: TFieldSpec): ICardState {
  return updateField(card, fieldId, field =>
    field.spec.kind === spec.kind ? { ...field, spec } : field
  );
}

export function setSensitive(card: ICardState, fieldId: TFieldId, sensitive: boolean): ICardState {
  return updateField(card, fieldId, field => ({ ...field, sensitive }));
}

export function setExcludeFromAudit(
  card: ICardState,
  fieldId: TFieldId,
  excludeFromAudit: boolean
): ICardState {
  return updateField(card, fieldId, field => ({ ...field, excludeFromAudit }));
}

export interface INewField {
  readonly kind: TFieldKind;
  readonly label: string;
  readonly cardinality: 'single' | 'list';
}

/** Any kind on any card; a list only where the kind allows one. */
export function addField(
  card: ICardState,
  tabId: TTabId,
  { kind, label, cardinality }: INewField,
  random: IRandom
): { readonly card: ICardState; readonly fieldId: TFieldId } {
  const row = FIELD_KINDS[kind];
  const field: ICardField = {
    id: newFieldId(random),
    label,
    spec: row.defaultSpec,
    value:
      cardinality === 'list' && row.listAllowed
        ? { cardinality: 'list', values: [] }
        : { cardinality: 'single', value: '' },
    sensitive: row.sensitiveByDefault,
    excludeFromAudit: false,
  };
  if (!card.tabs.some(tab => tab.id === tabId)) {
    return { card, fieldId: field.id };
  }
  return {
    card: withTabs(
      card,
      replaceById(card.tabs, tabId, tab => ({ ...tab, fields: [...tab.fields, field] }))
    ),
    fieldId: field.id,
  };
}

export function removeField(card: ICardState, fieldId: TFieldId): ICardState {
  const tab = tabOfField(card, fieldId);
  if (isNil(tab)) {
    return card;
  }
  return withTabs(
    card,
    replaceById(card.tabs, tab.id, current => ({
      ...current,
      fields: current.fields.filter(field => field.id !== fieldId),
    }))
  );
}

/** Within a tab or into another one, at the given position. */
export function moveField(
  card: ICardState,
  fieldId: TFieldId,
  toTabId: TTabId,
  index: number
): ICardState {
  const field = tabOfField(card, fieldId)?.fields.find(candidate => candidate.id === fieldId);
  if (isNil(field) || !card.tabs.some(tab => tab.id === toTabId)) {
    return card;
  }
  const without = card.tabs.map(tab => ({
    ...tab,
    fields: tab.fields.filter(candidate => candidate.id !== fieldId),
  }));
  return withTabs(
    card,
    without.map(tab =>
      tab.id === toTabId
        ? { ...tab, fields: [...tab.fields.slice(0, index), field, ...tab.fields.slice(index)] }
        : tab
    )
  );
}
