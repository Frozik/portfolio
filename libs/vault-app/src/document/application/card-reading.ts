import { fileAssetIdsOf } from '@frozik/vault/model/asset-edits';
import type { ICardField, IVaultCard } from '@frozik/vault/model/card';
import { fieldValues, passwordRotationOf } from '@frozik/vault/model/card';
import { changePasswordUrlOfCard } from '@frozik/vault/model/change-password-url';
import type { IFieldKind } from '@frozik/vault/model/field-kinds/field-kind';
import { FIELD_KINDS } from '@frozik/vault/model/field-kinds/registry';
import type { TAssetId, TFieldId, TTabId } from '@frozik/vault/model/ids';
import { BANK_CARD_TEMPLATE } from '@frozik/vault/model/templates/bank-card';
import { isNil } from 'lodash-es';

export interface IValueReading {
  /** The value's place in its field: what showing one value of a list remembers. */
  readonly index: number;
  readonly text: string;
  /** What copying puts on the clipboard (a card number without its spaces). */
  readonly copyText: string;
  /** A field of passwords in turn shows the one in use and the one before it. */
  readonly turn: 'current' | 'previous' | null;
}

interface IFieldHead {
  readonly id: TFieldId;
  readonly label: string;
}

/** A field as read; empty values and fields of kinds this build does not know are left out. */
export type TFieldReading =
  | (IFieldHead & {
      readonly kind: 'values';
      readonly sensitive: boolean;
      /** Off for a card kept shut by its protection. */
      readonly copyable: boolean;
      /** A secret may be shown in large type. */
      readonly largeType: boolean;
      readonly values: readonly IValueReading[];
    })
  | (IFieldHead & { readonly kind: 'one-time-code'; readonly uri: string })
  | (IFieldHead & {
      readonly kind: 'files';
      readonly sensitive: boolean;
      /** Empty while the card is shut. */
      readonly assetIds: readonly TAssetId[];
    });

export interface ITabReading {
  readonly id: TTabId;
  /** `null` for a tab without a name, which reads as the main one. */
  readonly title: string | null;
  readonly fields: readonly TFieldReading[];
}

export interface ICardReading {
  readonly tabs: readonly ITabReading[];
  readonly changePasswordUrl: string | null;
  /** A bank card, drawn as the physical card above its fields. */
  readonly bankCard: boolean;
}

function valuesOf(field: ICardField, kind: IFieldKind): readonly IValueReading[] {
  const read = (value: string, index: number, turn: IValueReading['turn']): IValueReading => ({
    index,
    text: kind.format(value, field.spec),
    copyText: kind.copyValue(value),
    turn,
  });
  const rotation = passwordRotationOf(field);
  if (!isNil(rotation)) {
    return isNil(rotation.previous)
      ? [read(rotation.current, 0, 'current')]
      : [read(rotation.current, 0, 'current'), read(rotation.previous, 1, 'previous')];
  }
  return fieldValues(field).flatMap((value, index) =>
    value === '' ? [] : [read(value, index, null)]
  );
}

function fieldReadingOf(field: ICardField, shut: boolean): TFieldReading | null {
  const { spec } = field;
  const head = { id: field.id, label: field.label };
  if (spec.kind === 'unknown') {
    return null;
  }
  if (spec.kind === 'file') {
    const assetIds = fileAssetIdsOf(field);
    return assetIds.length === 0
      ? null
      : { ...head, kind: 'files', sensitive: field.sensitive, assetIds: shut ? [] : assetIds };
  }
  const values = valuesOf(field, FIELD_KINDS[spec.kind]);
  if (values.length === 0) {
    return null;
  }
  if (spec.kind === 'otp' && !shut && field.value.cardinality === 'single') {
    return { ...head, kind: 'one-time-code', uri: field.value.value };
  }
  return {
    ...head,
    kind: 'values',
    sensitive: field.sensitive || spec.kind === 'otp',
    copyable: !shut && spec.kind !== 'otp',
    largeType: field.sensitive && !shut && spec.kind !== 'otp' && spec.kind !== 'multiline',
    values,
  };
}

/**
 * What a card shows when read. `shut` is a protected card whose gate is
 * closed: its secrets stay masked, nothing is copied, its files stay closed.
 */
export function readCard(card: IVaultCard, shut: boolean): ICardReading {
  return {
    tabs: card.tabs.map(tab => ({
      id: tab.id,
      title: tab.title,
      fields: tab.fields.flatMap(field => {
        const reading = fieldReadingOf(field, shut);
        return isNil(reading) ? [] : [reading];
      }),
    })),
    changePasswordUrl: changePasswordUrlOfCard(card),
    bankCard: card.templateId === BANK_CARD_TEMPLATE.id,
  };
}
