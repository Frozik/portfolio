import type { ICardField, IVaultCard } from '@frozik/vault/model/card';
import { allFields } from '@frozik/vault/model/card';
import { detectCardNetwork } from '@frozik/vault/model/card-network';
import { cardSubtitle } from '@frozik/vault/model/card-subtitle';
import { FIELD_KINDS } from '@frozik/vault/model/field-kinds/registry';
import { CardNetworkLogo } from '@frozik/vault/react/card-icon/CardNetworkLogo';
import { isNil } from 'lodash-es';
import { memo } from 'react';

import { getCurrentLanguage } from '../../../../shared/i18n/locale';
import { vaultT } from '../translations';

const NON_DIGIT = /\D/g;

function valueOf(card: IVaultCard, kind: ICardField['spec']['kind']): ICardField | undefined {
  return allFields(card).find(
    field =>
      field.spec.kind === kind && field.value.cardinality === 'single' && field.value.value !== ''
  );
}

function singleValue(field: ICardField | undefined): string {
  return field?.value.cardinality === 'single' ? field.value.value : '';
}

/**
 * A bank card drawn as the plastic it stands for: network,
 * the number as `•••• 1234`, holder and "valid thru". Nothing secret is
 * drawn: the full number, CVV and PIN stay in their fields below.
 */
export const PhysicalCard = memo(({ card }: { readonly card: IVaultCard }) => {
  const t = vaultT.cardExtras;
  const number = valueOf(card, 'card-number');
  if (isNil(number)) {
    return null;
  }
  const network = detectCardNetwork(singleValue(number).replace(NON_DIGIT, ''))?.network;
  const holder = singleValue(valueOf(card, 'text'));
  const validThru = valueOf(card, 'expiry-month');
  return (
    <div
      aria-hidden="true"
      className="flex aspect-[1.586] w-full max-w-[340px] flex-col justify-between rounded-2xl bg-gradient-to-br from-landing-fg-dim to-landing-fg p-5 font-mono text-landing-bg"
    >
      <span className="self-end">
        {!isNil(network) && (
          <CardNetworkLogo network={network} locale={getCurrentLanguage()} size="plastic" />
        )}
      </span>
      <span className="text-[20px] tracking-[0.12em]">{cardSubtitle(card)}</span>
      <div className="flex items-end justify-between gap-3 text-[12px] uppercase">
        <span className="truncate">{holder}</span>
        {!isNil(validThru) && (
          <span className="flex flex-col items-end">
            <span className="text-[9px] opacity-70">{t.validThru}</span>
            {FIELD_KINDS['expiry-month'].format(singleValue(validThru), validThru.spec)}
          </span>
        )}
      </div>
    </div>
  );
});
