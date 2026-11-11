import type { TCardColor } from '@frozik/vault/model/card';
import { CARD_COLOR_SHADES, CARD_COLORS } from '@frozik/vault/model/card-appearance';
import { isNil } from 'lodash-es';
import { Pressable, StyleSheet, View } from 'react-native';

import { TOUCH_SIZE } from '../kit/metrics';
import { useWidgetTexts } from '../texts';
import { usePalette, useScheme } from '../theme/AppTheme';

const SWATCH_SIZE = 32;
/** A swatch is drawn small but touched at full size. */
const SWATCH_SLOP = (TOUCH_SIZE - SWATCH_SIZE) / 2;

/** The vault's palette as round swatches, "no colour" first; one is chosen. */
export function ColorSwatches({
  value,
  onChange,
  testIDPrefix,
}: {
  readonly value: TCardColor | null;
  readonly onChange: (color: TCardColor | null) => void;
  /** Each swatch is `${prefix}-${colour}`, `${prefix}-none` for no colour. */
  readonly testIDPrefix: string;
}) {
  const palette = usePalette();
  const scheme = useScheme();
  const t = useWidgetTexts().appearance;
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t.color} style={styles.swatches}>
      {[null, ...CARD_COLORS].map(option => {
        const selected = option === value;
        return (
          <Pressable
            key={option ?? 'none'}
            testID={`${testIDPrefix}-${option ?? 'none'}`}
            accessibilityRole="radio"
            accessibilityLabel={isNil(option) ? t.noColor : t.colors[option]}
            accessibilityState={{ selected }}
            onPress={() => onChange(option)}
            hitSlop={SWATCH_SLOP}
            style={[
              styles.swatch,
              {
                backgroundColor: isNil(option)
                  ? palette.bgElevated
                  : CARD_COLOR_SHADES[option][scheme],
                borderColor: selected ? palette.accent : palette.line,
              },
              selected && styles.swatchSelected,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: SWATCH_SLOP * 2 },
  swatch: {
    width: SWATCH_SIZE,
    height: SWATCH_SIZE,
    borderRadius: SWATCH_SIZE / 2,
    borderWidth: 1,
  },
  swatchSelected: { borderWidth: 3 },
});
