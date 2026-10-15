import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TEXT_SIZE, TOUCH_SIZE } from '../kit/metrics';
import { useWidgetTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'spacer', '0', 'erase'] as const;
const KEY_SIZE = 72;
const DOT_SIZE = 12;
const ERASE_GLYPH = '⌫';

/**
 * A PIN of a known length, sent the moment the last digit is in. The digits
 * never show, only how many there are.
 */
export function PinPad({
  length,
  disabled = false,
  onComplete,
}: {
  readonly length: number;
  readonly disabled?: boolean;
  readonly onComplete: (digits: string) => void;
}) {
  const palette = usePalette();
  const t = useWidgetTexts().pinPad;
  const [digits, setDigits] = useState('');
  const add = (digit: string): void => {
    if (disabled || digits.length >= length) {
      return;
    }
    const next = digits + digit;
    setDigits(next.length === length ? '' : next);
    if (next.length === length) {
      onComplete(next);
    }
  };
  return (
    <View testID="pin-pad" accessibilityLabel={t.label} style={styles.pad}>
      <View
        accessibilityRole="text"
        accessibilityLabel={t.entered(digits.length, length)}
        style={styles.dots}
      >
        {Array.from({ length }, (_, position) => position).map(position => (
          <View
            key={position}
            style={[
              styles.dot,
              { borderColor: palette.fgDim },
              position < digits.length && { backgroundColor: palette.fg },
            ]}
          />
        ))}
      </View>
      <View style={styles.keys}>
        {KEYS.map(key =>
          key === 'spacer' ? (
            <View key={key} style={styles.key} />
          ) : (
            <Pressable
              key={key}
              testID={`pin-${key}`}
              accessibilityRole="button"
              accessibilityLabel={key === 'erase' ? t.erase : key}
              disabled={disabled}
              onPress={() => (key === 'erase' ? setDigits(digits.slice(0, -1)) : add(key))}
              style={({ pressed }) => [
                styles.key,
                { backgroundColor: pressed ? palette.accentSoft : palette.bgElevated },
              ]}
            >
              <Text style={[styles.label, { color: palette.fg }]}>
                {key === 'erase' ? ERASE_GLYPH : key}
              </Text>
            </Pressable>
          )
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { alignItems: 'center', gap: 24 },
  dots: { flexDirection: 'row', gap: 12, minHeight: TOUCH_SIZE / 2 },
  dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2, borderWidth: 1.5 },
  keys: { flexDirection: 'row', flexWrap: 'wrap', width: KEY_SIZE * 3 + 32, gap: 16 },
  key: {
    width: KEY_SIZE,
    height: KEY_SIZE,
    borderRadius: KEY_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: TEXT_SIZE.title },
});
