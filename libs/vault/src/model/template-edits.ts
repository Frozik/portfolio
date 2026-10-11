import type { TNonEmptyArray } from '@frozik/utils/types/base';
import { isNil } from 'lodash-es';

import type { IRandom } from '../ports/random';
import type { ICardField, ICardState } from './card';
import type { IVaultCard } from './card';
import { createCard } from './card-edits';
import type { IHlc } from './hlc';
import type { TTemplateId } from './ids';
import { newUserTemplateId } from './ids';
import { templateOf } from './templates/registry';
import type { ICardTemplate, ITemplateTab } from './templates/template';
import type { IUserTemplate, IUserTemplateField, IVaultDocument } from './vault-document';
import { DEFAULT_EXPIRY_WARNING_DAYS } from './vault-document';

function templateField(field: ICardField): IUserTemplateField | null {
  const { spec } = field;
  if (spec.kind === 'unknown') {
    return null;
  }
  return {
    kind: spec.kind,
    label: field.label,
    cardinality: field.value.cardinality,
    spec,
    sensitive: field.sensitive,
  };
}

/**
 * "save as template": the card's tabs and fields with their
 * labels, kinds and parameters, never its values; the icon its template had.
 */
export function saveAsTemplate(
  document: IVaultDocument,
  card: ICardState,
  name: string,
  at: IHlc,
  random: IRandom
): { readonly document: IVaultDocument; readonly templateId: TTemplateId } {
  const [first, ...others] = card.tabs.map(tab => ({
    title: tab.title,
    fields: tab.fields.flatMap(field => templateField(field) ?? []),
  }));
  const template: IUserTemplate = {
    id: newUserTemplateId(random),
    name: name.trim(),
    icon: card.icon.kind === 'builtin' ? card.icon.name : templateOf(card.templateId).icon,
    tabs: [first, ...others],
    updatedAt: at,
  };
  return {
    templateId: template.id,
    document: { ...document, templates: new Map(document.templates).set(template.id, template) },
  };
}

export function renameTemplate(
  document: IVaultDocument,
  id: TTemplateId,
  name: string,
  at: IHlc
): IVaultDocument {
  const template = document.templates.get(id);
  return isNil(template)
    ? document
    : {
        ...document,
        templates: new Map(document.templates).set(id, {
          ...template,
          name: name.trim(),
          updatedAt: at,
        }),
      };
}

/** Cards made from it keep their fields: a template is only a starting point. */
export function deleteTemplate(
  document: IVaultDocument,
  id: TTemplateId,
  at: IHlc
): IVaultDocument {
  if (!document.templates.has(id)) {
    return document;
  }
  const templates = new Map(document.templates);
  templates.delete(id);
  return {
    ...document,
    templates,
    tombstones: new Map(document.tombstones).set(`template:${id}`, at),
  };
}

/** The shape `createCard` takes, the user's words standing where a built-in template has translation keys. */
function asCardTemplate(template: IUserTemplate): ICardTemplate {
  const toTab = (tab: IUserTemplate['tabs'][number]): ITemplateTab => ({
    titleKey: tab.title,
    fields: tab.fields.map(field => ({
      kind: field.kind,
      labelKey: field.label,
      cardinality: field.cardinality,
      spec: field.spec,
      sensitive: field.sensitive,
    })),
  });
  const [first, ...others] = template.tabs;
  const tabs: TNonEmptyArray<ITemplateTab> = [toTab(first), ...others.map(toTab)];
  return {
    id: template.id,
    nameKey: template.name,
    icon: template.icon,
    tabs,
    subtitleFieldKind: null,
    expiryWarningDays: DEFAULT_EXPIRY_WARNING_DAYS,
  };
}

/**
 * A new card from a user template: its words as they are (no
 * translation), and the template's icon, since its id names no built-in one.
 */
export function createCardFromUserTemplate(
  template: IUserTemplate,
  random: IRandom,
  at: IHlc
): IVaultCard {
  const card = createCard(asCardTemplate(template), { translate: text => text, random }, at);
  return { ...card, icon: { kind: 'builtin', name: template.icon } };
}
