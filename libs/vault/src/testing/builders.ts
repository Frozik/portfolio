import type { ICardField, ICardTab, IVaultCard, TFieldSpec } from '../model/card';
import type { IHlc } from '../model/hlc';
import type { TCardId, TFieldId, TTabId, TTemplateId } from '../model/ids';
import type { IVaultDocument } from '../model/vault-document';
import { emptyVaultDocument } from '../model/vault-document';

let sequence = 0;

function nextId(prefix: string): string {
  sequence += 1;
  return `${prefix}-${String(sequence).padStart(4, '0')}`;
}

export function anHlc(wallMs: number, node = 'device-a:1', counter = 0): IHlc {
  return { wallMs, counter, node };
}

export function aField(
  spec: TFieldSpec,
  value: string | readonly string[],
  overrides: Partial<ICardField> = {}
): ICardField {
  return {
    id: nextId('field') as TFieldId,
    label: spec.kind,
    spec,
    value:
      typeof value === 'string'
        ? { cardinality: 'single', value }
        : { cardinality: 'list', values: value },
    sensitive: false,
    excludeFromAudit: false,
    ...overrides,
  };
}

export function aTab(fields: readonly ICardField[], title: string | null = null): ICardTab {
  return { id: nextId('tab') as TTabId, title, fields };
}

export function aCard(overrides: Partial<IVaultCard> = {}): IVaultCard {
  const at = anHlc(1);
  return {
    id: nextId('card') as TCardId,
    title: 'Card',
    templateId: 'blank' as TTemplateId,
    tabs: [aTab([])],
    groupIds: [],
    favorite: false,
    color: null,
    icon: { kind: 'auto' },
    protected: false,
    archivedAt: null,
    trashedAt: null,
    createdAt: at,
    updatedAt: at,
    ancestors: [],
    history: [],
    ...overrides,
  };
}

export function aCardWith(
  fields: readonly ICardField[],
  overrides: Partial<IVaultCard> = {}
): IVaultCard {
  return aCard({ tabs: [aTab(fields)], ...overrides });
}

export function aDocument(
  cards: readonly IVaultCard[] = [],
  overrides: Partial<IVaultDocument> = {}
): IVaultDocument {
  return {
    ...emptyVaultDocument('Test vault', anHlc(1)),
    cards: new Map(cards.map(card => [card.id, card])),
    ...overrides,
  };
}
