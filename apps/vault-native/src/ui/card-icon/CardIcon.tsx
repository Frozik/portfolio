import { NATIVE_PALETTES } from '@frozik/components/tokens/native-tokens';
import { toBase64 } from '@frozik/vault/crypto/bytes';
import type { ICardState } from '@frozik/vault/model/card';
import {
  builtinIconOf,
  CARD_COLOR_SHADES,
  cardColorOf,
  cardNetworkOf,
  cardTileColorOf,
} from '@frozik/vault/model/card-appearance';
import { isNil } from 'lodash-es';
import { memo, useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { usePalette, useScheme } from '../theme/AppTheme';
import { BUILTIN_ICON_COMPONENTS } from './builtin-icon-components';
import { CardNetworkLogo } from './CardNetworkLogo';

const SIZE = 40;
const GLYPH_SIZE = 22;
const PICTURE_SIZE = 28;
/** The card's colour behind an automatic icon, faint enough for a logo to read on it. */
const TILE_TINT_ALPHA = '38';

/**
 * A card's icon, as the web draws it: a card number's network logo, else the site's icon — both on
 * the card's colour when one is chosen — else the chosen built-in icon in the card's colour, else
 * the template's.
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
  const picture = useMemo(
    () =>
      isNil(siteIcon) || card.icon.kind !== 'auto'
        ? null
        : `data:image/png;base64,${toBase64(siteIcon)}`,
    [siteIcon, card.icon.kind]
  );
  const network = cardNetworkOf(card);
  const color = cardColorOf(card);
  const tile = cardTileColorOf(card);
  const Glyph = BUILTIN_ICON_COMPONENTS[builtinIconOf(card)];
  /** Sites draw their icons for a light browser tab: in the dark theme a black logo would vanish. */
  const lightPlate = isNil(network) && !isNil(picture);
  const tintOf = (shade: 'light' | 'dark'): string | null =>
    isNil(tile) ? null : `${CARD_COLOR_SHADES[tile][shade]}${TILE_TINT_ALPHA}`;
  const plateTint = lightPlate ? tintOf('light') : null;
  return (
    <View
      testID="card-icon"
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.tile,
        {
          backgroundColor: lightPlate
            ? NATIVE_PALETTES.light.bgElevated
            : (tintOf(scheme) ?? palette.bgElevated),
        },
      ]}
    >
      {!isNil(plateTint) && (
        <View testID="card-icon-tint" style={[styles.tint, { backgroundColor: plateTint }]} />
      )}
      {!isNil(network) ? (
        <CardNetworkLogo network={network} />
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
  tint: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: SIZE / 4 },
  picture: { width: PICTURE_SIZE, height: PICTURE_SIZE, resizeMode: 'contain' },
});
