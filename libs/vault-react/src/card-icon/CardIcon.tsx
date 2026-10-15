import { cn } from '@frozik/components/components/cn';
import { isNil } from 'lodash-es';
import { memo } from 'react';

import type { ICardState } from '@frozik/vault/model/card';
import { builtinIconOf, cardColorOf, cardNetworkOf } from '@frozik/vault/model/card-appearance';
import { BUILTIN_ICON_COMPONENTS } from './builtin-icon-components';
import { CardNetworkLogo } from './CardNetworkLogo';
import styles from './card-icon.module.css';
import controlTokens from '@frozik/components/components/control-tokens.module.css';

const ICON_SIZE = 18;

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
    const network = cardNetworkOf(card);
    if (!isNil(network)) {
      return <CardNetworkLogo network={network} locale={locale} />;
    }
    if (card.icon.kind === 'auto' && !isNil(picture)) {
      return (
        <span className={cn(controlTokens.tokens, styles.icon)} aria-hidden="true">
          <img className={styles.picture} src={picture} alt="" />
        </span>
      );
    }
    const builtin = builtinIconOf(card);
    const Icon = BUILTIN_ICON_COMPONENTS[builtin];
    const color = cardColorOf(card);
    const colorClass = isNil(color) ? '' : styles[color];
    return (
      <span
        className={cn(controlTokens.tokens, styles.icon, colorClass)}
        aria-hidden="true"
        data-icon={builtin}
        data-color={color ?? undefined}
      >
        <Icon size={ICON_SIZE} />
      </span>
    );
  }
);
