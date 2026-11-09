import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { MaskEditor } from '../../contexts/masks/application/MaskEditor';
import { useTexts } from '../../texts/use-texts';
import { Chip } from '../kit/Chip';
import { RADIUS, SMALL_GAP, TEXT_SIZE, TOUCH_SIZE } from '../kit/metrics';
import { Sheet } from '../kit/Sheet';
import { Wrap } from '../kit/Wrap';
import { usePalette } from '../theme/AppTheme';

const ROWS: readonly (readonly string[])[] = [
  ['1', '2', '3', '.'],
  ['4', '5', '6', '*'],
  ['7', '8', '9', '{…}'],
  ['+', '0', ' ', '⌫'],
];
const EXACT = [2, 3, 4, 5, 6] as const;
const RANGES: readonly (readonly [number, number])[] = [
  [1, 2],
  [1, 3],
  [2, 3],
  [2, 4],
];

/** The mask's own keypad: digits, «.», «*», «+», a space, and {…} without typing braces. */
export const NumberKeypad = observer(function NumberKeypad({
  editor,
}: {
  readonly editor: MaskEditor;
}) {
  const texts = useTexts();
  const palette = usePalette();
  const [repeating, setRepeating] = useState(false);
  const press = (key: string) => {
    if (key === '⌫') {
      editor.erase();
    } else if (key === '{…}') {
      setRepeating(true);
    } else {
      editor.insert(key);
    }
  };
  const startsWith = () => {
    if (!editor.source.endsWith('*')) {
      editor.insert('*');
    }
  };
  const repeat = (text: string) => {
    editor.insert(text);
    setRepeating(false);
  };
  return (
    <View testID="mask-keypad" style={styles.pad}>
      {ROWS.map(row => (
        <View key={row.join('')} style={styles.row}>
          {row.map(key => (
            <Pressable
              key={key}
              testID={`key-${key === ' ' ? 'space' : key === '⌫' ? 'erase' : key === '{…}' ? 'repeat' : key}`}
              accessibilityRole="button"
              accessibilityLabel={key === ' ' ? 'space' : key}
              onPress={() => press(key)}
              style={({ pressed }) => [
                styles.key,
                {
                  backgroundColor: pressed ? palette.accentSoft : palette.bgCard,
                  borderColor: palette.lineSoft,
                },
              ]}
            >
              <Text style={[styles.keyText, { color: palette.fg }]}>{key === ' ' ? '␣' : key}</Text>
            </Pressable>
          ))}
        </View>
      ))}
      <Chip testID="key-starts-with" label={texts.mask.startsWith} onPress={startsWith} />
      <Sheet
        visible={repeating}
        title={texts.mask.repeatTitle}
        onClose={() => setRepeating(false)}
        testID="repeat-sheet"
      >
        <Wrap>
          {EXACT.map(count => (
            <Chip
              key={count}
              testID={`repeat-${count}`}
              label={`${texts.mask.exactlyN} ${count}`}
              onPress={() => repeat(`{${count}}`)}
            />
          ))}
        </Wrap>
        <Wrap>
          {RANGES.map(([from, to]) => (
            <Chip
              key={`${from}-${to}`}
              testID={`repeat-${from}-${to}`}
              label={`${from}–${to}`}
              onPress={() => repeat(`{${from},${to}}`)}
            />
          ))}
        </Wrap>
      </Sheet>
    </View>
  );
});

const styles = StyleSheet.create({
  pad: { gap: SMALL_GAP },
  row: { flexDirection: 'row', gap: SMALL_GAP },
  key: {
    flex: 1,
    minHeight: TOUCH_SIZE + 4,
    borderRadius: RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: { fontSize: TEXT_SIZE.title, fontWeight: '500' },
});
