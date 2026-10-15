import { toBase64 } from '@frozik/vault/crypto/bytes';
import type { ICardState } from '@frozik/vault/model/card';
import {
  builtinIconOf,
  CARD_COLOR_SHADES,
  cardColorOf,
  cardNetworkOf,
} from '@frozik/vault/model/card-appearance';
import { isNil } from 'lodash-es';
import { memo, useMemo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { useWidgetTexts } from '../texts';
import { usePalette, useScheme } from '../theme/AppTheme';
import { BUILTIN_ICON_COMPONENTS } from './builtin-icon-components';

const SIZE = 40;
const GLYPH_SIZE = 22;
const PICTURE_SIZE = 28;
const NETWORK_TEXT_SIZE = 9;

/**
 * A card's icon, as the web draws it: a card number's network, else the site's icon, else the
 * chosen built-in icon in the card's colour, else the template's. The phone names a network
 * rather than drawing its logo.
 */
export const CardIcon = memo(function CardIcon({
  card,
  siteIcon,
}: {
  readonly card: ICardState;
  /** The site's icon from the vault, shown by a card that keeps the automatic one. */
  readonly siteIcon: Uint8Array<ArrayBuffer> | null;
}) {
  const palette = usePalette();
  const scheme = useScheme();
  const networks = useWidgetTexts().networks;
  const picture = useMemo(
    () =>
      isNil(siteIcon) || card.icon.kind !== 'auto'
        ? null
        : `data:image/png;base64,${toBase64(siteIcon)}`,
    [siteIcon, card.icon.kind]
  );
  const network = cardNetworkOf(card);
  const color = cardColorOf(card);
  const Glyph = BUILTIN_ICON_COMPONENTS[builtinIconOf(card)];
  return (
    <View
      testID="card-icon"
      importantForAccessibility="no-hide-descendants"
      style={[styles.tile, { backgroundColor: palette.bgElevated }]}
    >
      {!isNil(network) ? (
        <Text
          testID={`network-${network}`}
          numberOfLines={1}
          style={[styles.network, { color: palette.fg }]}
        >
          {networks[network]}
        </Text>
      ) : !isNil(picture) ? (
        <Image testID="site-icon" source={{ uri: picture }} style={styles.picture} />
      ) : (
        <Glyph
          testID={`builtin-icon-${builtinIconOf(card)}`}
          size={GLYPH_SIZE}
          color={isNil(color) ? palette.fgDim : CARD_COLOR_SHADES[color][scheme]}
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  tile: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  picture: { width: PICTURE_SIZE, height: PICTURE_SIZE, resizeMode: 'contain' },
  network: { fontSize: NETWORK_TEXT_SIZE, fontWeight: '700' },
});
