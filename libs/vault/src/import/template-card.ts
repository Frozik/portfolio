import { assert } from '@frozik/utils/assert/assert';
import type { TNonEmptyArray } from '@frozik/utils/types/base';
import { isNil } from 'lodash-es';

import type { TFieldKind, TFieldSpec, TFieldValue } from '../model/card';
import { FIELD_KINDS } from '../model/field-kinds/registry';
import type { ICardTemplate, ITemplateField, ITemplateTab } from '../model/templates/template';
import { NOTES } from '../model/templates/template';
import type { IImportedCard, IImportedField, IImportedTab, TImportLabel } from './imported-card';
import { keyLabel } from './imported-card';

export type TImportValue = string | readonly string[];

/** A template field's value, and the spec it takes instead of the template's (a URL's matching rule). */
export interface IFill {
  readonly value: TImportValue;
  readonly spec?: TFieldSpec;
}

function valueOf(value: TImportValue, cardinality: 'single' | 'list'): TFieldValue {
  const values = (typeof value === 'string' ? [value] : value).filter(entry => entry !== '');
  return cardinality === 'list'
    ? { cardinality: 'list', values }
    : { cardinality: 'single', value: values.join('\n') };
}

/** A field the template does not have: a source's custom field, a one-time code on an account. */
export function extraField(
  kind: TFieldKind,
  label: TImportLabel,
  value: TImportValue,
  spec: TFieldSpec = FIELD_KINDS[kind].defaultSpec
): IImportedField {
  const row = FIELD_KINDS[kind];
  return {
    label,
    spec,
    value: valueOf(value, typeof value !== 'string' && row.listAllowed ? 'list' : 'single'),
    sensitive: row.sensitiveByDefault,
    hotpCounter: null,
  };
}

function templateField(field: ITemplateField, fill: IFill | undefined): IImportedField {
  return {
    label: keyLabel(field.labelKey),
    spec: fill?.spec ?? field.spec ?? FIELD_KINDS[field.kind].defaultSpec,
    value: valueOf(fill?.value ?? '', field.cardinality),
    sensitive: FIELD_KINDS[field.kind].sensitiveByDefault,
    hotpCounter: null,
  };
}

/**
 * The template's tabs as a new card would have them, with the
 * values a source has for them — keyed by the template field's label key —
 * and the source's other fields after them, on the tab with the notes.
 */
export function templateTabs(
  template: ICardTemplate,
  fills: Readonly<Partial<Record<string, IFill>>>,
  extras: readonly IImportedField[]
): TNonEmptyArray<IImportedTab> {
  const toTab = (tab: ITemplateTab): IImportedTab => ({
    title: isNil(tab.titleKey) ? null : keyLabel(tab.titleKey),
    fields: tab.fields.map(field => templateField(field, fills[field.labelKey])),
  });
  const notesTab = template.tabs.findIndex(tab =>
    tab.fields.some(field => field.labelKey === NOTES.labelKey)
  );
  const extrasTab = Math.max(notesTab, 0);
  const [first, ...others] = template.tabs.map((tab, index) => {
    const imported = toTab(tab);
    return index === extrasTab
      ? { ...imported, fields: [...imported.fields, ...extras] }
      : imported;
  });
  assert(!isNil(first), 'a template has a tab');
  return [first, ...others];
}

export function fill(value: TImportValue, spec?: TFieldSpec): IFill {
  return { value, spec };
}

/** A card with no group, mark or date: what most sources say about an entry. */
export function plainCard(
  template: ICardTemplate,
  title: string,
  tabs: TNonEmptyArray<IImportedTab>,
  details: Partial<Omit<IImportedCard, 'templateId' | 'title' | 'tabs'>> = {}
): IImportedCard {
  return {
    templateId: template.id,
    title,
    tabs,
    groups: [],
    favorite: false,
    protected: false,
    archived: false,
    color: null,
    icon: { kind: 'auto' },
    createdAtMs: null,
    ...details,
  };
}
