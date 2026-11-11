import type { TCardNetwork } from '@frozik/vault/model/card-network';
import { isNil } from 'lodash-es';
import type { ComponentType } from 'react';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { SvgProps } from 'react-native-svg';
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
} from 'react-svg-credit-card-payment-icons/native/icons/flat-rounded';

import { useWidgetTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';

/** The logos are drawn 780 × 500, as a card is. */
const LOGO_WIDTH = 34;
const LOGO_HEIGHT = 22;
const WORD_MARK_SIZE = 9;

/** The same logos the web draws; the set has no Troy, Naranja, Verve or Belkart, which keep a word mark. */
const NETWORK_LOGOS: Readonly<Record<TCardNetwork, ComponentType<SvgProps> | null>> = {
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
  belkart: null,
  verve: null,
};

/** Which network a card number belongs to: its logo, named for a screen reader. */
export const CardNetworkLogo = memo(function CardNetworkLogo({
  network,
}: {
  readonly network: TCardNetwork;
}) {
  const palette = usePalette();
  const name = useWidgetTexts().networks[network];
  const Logo = NETWORK_LOGOS[network];
  if (isNil(Logo)) {
    return (
      <Text
        testID={`network-${network}`}
        numberOfLines={1}
        style={[styles.wordMark, { color: palette.fg }]}
      >
        {name}
      </Text>
    );
  }
  return (
    <View
      testID={`network-${network}`}
      accessible
      accessibilityRole="image"
      accessibilityLabel={name}
    >
      <Logo width={LOGO_WIDTH} height={LOGO_HEIGHT} />
    </View>
  );
});

const styles = StyleSheet.create({
  wordMark: { fontSize: WORD_MARK_SIZE, fontWeight: '700' },
});
