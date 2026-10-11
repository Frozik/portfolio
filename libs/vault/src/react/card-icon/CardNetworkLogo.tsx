import { isNil } from 'lodash-es';
import type { ComponentType, SVGProps } from 'react';
import { memo } from 'react';
import {
  AmericanExpress,
  DinersClub,
  Discover,
  Elo,
  Hiper,
  Hipercard,
  JCB,
  Maestro,
  Mastercard,
  Mir,
  UnionPay,
  Visa,
} from 'react-svg-credit-card-payment-icons/icons/flat-rounded';

import type { TCardNetwork } from '../../model/card-network';
import { getVaultReactTranslations } from '../translations/translations';
import styles from './card-icon.module.css';

/** The icon set draws no Troy, Naranja or Verve: those keep a word mark. */
const NETWORK_LOGOS: Readonly<Record<TCardNetwork, ComponentType<SVGProps<SVGSVGElement>> | null>> =
  {
    visa: Visa,
    mastercard: Mastercard,
    'american-express': AmericanExpress,
    'diners-club': DinersClub,
    discover: Discover,
    jcb: JCB,
    unionpay: UnionPay,
    maestro: Maestro,
    mir: Mir,
    elo: Elo,
    hiper: Hiper,
    hipercard: Hipercard,
    troy: null,
    naranja: null,
    verve: null,
  };

/** Which network a card number belongs to: its logo, named for assistive technology. */
export const CardNetworkLogo = memo(
  ({
    network,
    locale,
    size = 'icon',
  }: {
    readonly network: TCardNetwork;
    readonly locale: string;
    /** In a card's icon slot, or large on the drawn plastic. */
    readonly size?: 'icon' | 'plastic';
  }) => {
    const name = getVaultReactTranslations(locale).networks[network];
    const Logo = NETWORK_LOGOS[network];
    if (isNil(Logo)) {
      return (
        <span className={styles.network} data-network={network}>
          {name}
        </span>
      );
    }
    return (
      <span
        className={size === 'icon' ? styles.icon : undefined}
        role="img"
        aria-label={name}
        data-network={network}
      >
        <Logo
          className={size === 'icon' ? styles.networkLogo : styles.plasticLogo}
          aria-hidden="true"
        />
      </span>
    );
  }
);
