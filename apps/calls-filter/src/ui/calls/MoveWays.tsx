import type { LucideIcon } from 'lucide-react-native';
import { Layers, Phone } from 'lucide-react-native';
import { useState } from 'react';
import type { TextLayoutEvent } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  DIMMED_OPACITY,
  GUTTER,
  ICON_SIZE,
  RADIUS,
  SMALL_GAP,
  TEXT_SIZE,
  TOUCH_SIZE,
} from '../kit/metrics';
import { usePalette } from '../theme/AppTheme';

/** The number and the pool are written at this size or not at all: when either does not fit whole, both buttons keep only their icons. */
const WAY_TEXT_SIZE = TEXT_SIZE.body;

/** What a move takes: the caller's own number, or the whole pool of the operator's range. */
export type TMoveWay = 'number' | 'pool';

/** One way to move: an icon, and the number or the pool beside it while it has the room. */
function Way({
  icon: Icon,
  label,
  shown,
  onOverflow,
  testID,
  onPress,
}: {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly shown: boolean;
  /** A number reads only whole: when it would wrap, it asks for the icons alone instead. */
  readonly onOverflow: () => void;
  readonly testID: string;
  readonly onPress: () => void;
}) {
  const palette = usePalette();
  const overflowWhenWrapped = (event: TextLayoutEvent) => {
    if (event.nativeEvent.lines.length > 1) {
      onOverflow();
    }
  };
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.way,
        shown ? styles.fitted : styles.iconOnly,
        { borderColor: palette.line, backgroundColor: palette.bgCard },
        pressed && styles.dimmed,
      ]}
    >
      <Icon color={palette.accent} size={ICON_SIZE} />
      {shown ? (
        <Text onTextLayout={overflowWhenWrapped} style={[styles.label, { color: palette.fg }]}>
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

/**
 * Under a group of «To group…»: what goes there, the caller's number or the whole pool of its
 * operator's range — written out where both fit whole, two icons where they do not.
 */
export function MoveWays({
  number,
  pool,
  testID,
  onPick,
}: {
  readonly number: string;
  /** The pool as written: the number's first digits and an ellipsis, `+7 986…`. */
  readonly pool: string;
  readonly testID: string;
  readonly onPick: (way: TMoveWay) => void;
}) {
  const palette = usePalette();
  const [crampedFor, setCrampedFor] = useState<string | null>(null);
  const shown = crampedFor !== number;
  const cramp = () => setCrampedFor(number);
  return (
    <View style={[styles.ways, { borderBottomColor: palette.lineSoft }]}>
      <Way
        key={`number-${String(shown)}`}
        icon={Phone}
        label={number}
        shown={shown}
        onOverflow={cramp}
        testID={`${testID}-number`}
        onPress={() => onPick('number')}
      />
      <Way
        key={`pool-${String(shown)}`}
        icon={Layers}
        label={pool}
        shown={shown}
        onOverflow={cramp}
        testID={`${testID}-pool`}
        onPress={() => onPick('pool')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  ways: {
    flexDirection: 'row',
    gap: SMALL_GAP,
    paddingHorizontal: GUTTER,
    paddingBottom: GUTTER,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  way: {
    minHeight: TOUCH_SIZE,
    borderRadius: RADIUS,
    borderWidth: 1,
    paddingHorizontal: SMALL_GAP * 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SMALL_GAP,
  },
  fitted: { flexShrink: 1 },
  iconOnly: { flexGrow: 1, flexBasis: 0, justifyContent: 'center' },
  label: { flexShrink: 1, fontSize: WAY_TEXT_SIZE, fontWeight: '600' },
  dimmed: { opacity: DIMMED_OPACITY },
});
