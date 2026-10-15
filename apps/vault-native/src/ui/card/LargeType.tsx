import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Dialog } from '../kit/Dialog';
import { usePalette } from '../theme/AppTheme';

const DIGIT = /^\p{Nd}$/u;
const LETTER = /^\p{L}$/u;
/** A space would be invisible in a cell; the open-box sign stands for it. */
const SPACE_SIGN = '␣';
const CELL_SIZE = 44;

/** A character's place is its identity — the same letter repeats — and the place is what the cell shows. */
function cellsOf(
  value: string
): readonly { readonly position: number; readonly character: string }[] {
  return [...value].map((character, index) => ({ position: index + 1, character }));
}

/**
 * A secret written out to be typed on another device: big, every position
 * numbered, digits and symbols in their own colours. Split by code point, so
 * an emoji is one cell.
 */
export function LargeType({
  label,
  value,
  onClose,
}: {
  readonly label: string;
  readonly value: string;
  readonly onClose: () => void;
}) {
  const palette = usePalette();
  const colourOf = (character: string): string =>
    DIGIT.test(character) ? palette.accent : LETTER.test(character) ? palette.fg : palette.caution;
  return (
    <Dialog testID="large-type" open title={label} onClose={onClose}>
      <ScrollView contentContainerStyle={styles.cells}>
        {cellsOf(value).map(({ position, character }) => (
          <View key={position} style={[styles.cell, { borderColor: palette.line }]}>
            <Text style={[styles.character, { color: colourOf(character) }]}>
              {character === ' ' ? SPACE_SIGN : character}
            </Text>
            <Text style={[styles.position, { color: palette.fgFaint }]}>{position}</Text>
          </View>
        ))}
      </ScrollView>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  cells: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cell: {
    width: CELL_SIZE,
    borderWidth: 1,
    borderRadius: 6,
    alignItems: 'center',
    paddingVertical: 4,
  },
  character: { fontSize: 28, fontFamily: 'monospace' },
  position: { fontSize: 10 },
});
