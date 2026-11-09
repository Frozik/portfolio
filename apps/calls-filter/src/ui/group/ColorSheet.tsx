import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { TGroupColor } from '../../contexts/grouping/domain/group';
import { COLOR_SLOTS } from '../../contexts/grouping/domain/group';
import { parseHexColor } from '../../contexts/grouping/domain/hex-color';
import { useTexts } from '../../texts/use-texts';
import { Button } from '../kit/Button';
import { ColorField } from '../kit/ColorField';
import { Hint } from '../kit/Hint';
import { GAP, SMALL_GAP } from '../kit/metrics';
import { Sheet } from '../kit/Sheet';
import { Swatch } from '../kit/Swatch';
import { TextField } from '../kit/TextField';
import { useScheme } from '../theme/AppTheme';
import { groupColor } from '../theme/group-colors';
import type { IHsv } from '../theme/hsv';
import { hexToHsv, hsvToHex } from '../theme/hsv';

const HASH = 1;

/**
 * A group's colour: one of the theme's own in a tap, or any colour — dragged on the square and
 * the hue strip, or typed as hex (FF8800) — confirmed with «Done».
 */
export function ColorSheet({
  value,
  onChange,
  onClose,
}: {
  readonly value: TGroupColor;
  readonly onChange: (color: TGroupColor) => void;
  readonly onClose: () => void;
}) {
  const texts = useTexts();
  const scheme = useScheme();
  const shown = parseHexColor(groupColor(value, scheme));
  const [picked, setPicked] = useState<IHsv>(() =>
    hexToHsv(shown ?? hsvToHex({ hue: 0, saturation: 1, value: 1 }))
  );
  const [typed, setTyped] = useState(() => hsvToHex(picked).slice(HASH).toUpperCase());
  const choose = (color: TGroupColor) => {
    onChange(color);
    onClose();
  };
  const drag = (next: IHsv) => {
    setPicked(next);
    setTyped(hsvToHex(next).slice(HASH).toUpperCase());
  };
  const type = (text: string) => {
    setTyped(text);
    const hex = parseHexColor(text);
    if (hex !== null) {
      setPicked(hexToHsv(hex));
    }
  };
  const pickedHex = hsvToHex(picked);
  return (
    <Sheet visible title={texts.group.color} onClose={onClose} testID="color-sheet">
      <Hint text={texts.group.colorThemed} />
      <View style={styles.slots}>
        {COLOR_SLOTS.map(slot => (
          <Swatch
            key={slot}
            testID={`color-${slot}`}
            label={slot}
            color={groupColor(slot, scheme)}
            selected={value === slot}
            onPress={() => choose(slot)}
          />
        ))}
      </View>
      <Hint text={texts.group.colorPalette} />
      <ColorField testID="color-field" value={picked} onChange={drag} />
      <View style={styles.hexLine}>
        <Swatch
          testID="color-preview"
          label={pickedHex}
          color={pickedHex}
          selected={false}
          onPress={() => choose(pickedHex)}
        />
        <View style={styles.hexField}>
          <TextField
            testID="color-hex"
            label={texts.group.colorHex}
            placeholder="FF8800"
            value={typed}
            onChange={type}
            monospace
          />
        </View>
      </View>
      <Button
        testID="color-hex-apply"
        label={texts.common.done}
        disabled={parseHexColor(typed) === null}
        onPress={() => choose(pickedHex)}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  slots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: SMALL_GAP,
  },
  hexLine: { flexDirection: 'row', alignItems: 'flex-end', gap: GAP },
  hexField: { flex: 1 },
});
