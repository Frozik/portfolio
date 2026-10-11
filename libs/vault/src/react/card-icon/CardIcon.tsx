import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';
import { memo } from 'react';

import type { TBuiltinIcon } from '../../model/builtin-icons';
import type { ICardState } from '../../model/card';
import { allFields } from '../../model/card';
import type { TCardNetwork } from '../../model/card-network';
import { detectCardNetwork } from '../../model/card-network';
import { templateOf } from '../../model/templates/registry';
import { BUILTIN_ICON_COMPONENTS } from './builtin-icon-components';
import { CardNetworkLogo } from './CardNetworkLogo';
import styles from './card-icon.module.css';

const ICON_SIZE = 18;

function builtinOf(card: ICardState): TBuiltinIcon {
  const { icon } = card;
  switch (icon.kind) {
    case 'builtin':
      return icon.name;
    case 'auto':
    case 'custom':
      return templateOf(card.templateId).icon;
    default:
      return assertNever(icon);
  }
}

const NON_DIGIT = /\D/g;

function networkOf(card: ICardState): TCardNetwork | null {
  if (card.icon.kind !== 'auto') {
    return null;
  }
  const number = allFields(card).find(field => field.spec.kind === 'card-number');
  const digits =
    number?.value.cardinality === 'single' ? number.value.value.replace(NON_DIGIT, '') : '';
  return digits === '' ? null : (detectCardNetwork(digits)?.network ?? null);
}

/**
 * A card's icon: the chosen one, in the card's colour; for
 * `auto`, the network of a card number, else the site's icon, else the
 * template's.
 */
export const CardIcon = memo(
  ({
    card,
    locale,
    picture = null,
  }: {
    readonly card: ICardState;
    readonly locale: string;
    /** The site's icon (an object URL) for a card showing the automatic one. */
    readonly picture?: string | null;
  }) => {
    const network = networkOf(card);
    if (!isNil(network)) {
      return <CardNetworkLogo network={network} locale={locale} />;
    }
    if (card.icon.kind === 'auto' && !isNil(picture)) {
      return (
        <span className={styles.icon} aria-hidden="true">
          <img className={styles.picture} src={picture} alt="" />
        </span>
      );
    }
    const Icon = BUILTIN_ICON_COMPONENTS[builtinOf(card)];
    const colorClass = card.icon.kind !== 'builtin' || isNil(card.color) ? '' : styles[card.color];
    return (
      <span className={`${styles.icon} ${colorClass ?? ''}`} aria-hidden="true">
        <Icon size={ICON_SIZE} />
      </span>
    );
  }
);
