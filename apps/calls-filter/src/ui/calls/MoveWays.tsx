import type { LucideIcon } from 'lucide-react-native';
import { Phone, Type } from 'lucide-react-native';
import { useState } from 'react';
import type { TextLayoutEvent } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { TMoveKey } from '../../contexts/grouping/domain/caller-move';
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

/** The number and the name are written at this size or not at all: when the number does not fit whole, both buttons keep only their icons. */
const WAY_TEXT_SIZE = TEXT_SIZE.body;
/** The name's button never gets narrower than its icon and a few letters before the ellipsis. */
const NAME_MIN_WIDTH = 104;

/** One way to move: an icon, and the number or the name beside it while it has the room. */
function Way({
  icon: Icon,
  label,
  shown,
  whole,
  onOverflow,
  testID,
  onPress,
}: {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly shown: boolean;
  /** A number reads only whole: when it would wrap, it asks for the icons alone instead. */
  readonly whole: boolean;
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
        shown ? (whole ? styles.fitted : styles.rest) : styles.iconOnly,
        { borderColor: palette.line, backgroundColor: palette.bgCard },
        pressed && styles.dimmed,
      ]}
    >
      <Icon color={palette.accent} size={ICON_SIZE} />
      {shown ? (
        <Text
          numberOfLines={whole ? undefined : 1}
          onTextLayout={whole ? overflowWhenWrapped : undefined}
          style={[styles.label, { color: palette.fg }]}
        >
          {label}
        </Text>
      ) : null}
    </Pressable>
  );
}

/**
 * Under a group of «To group…»: what goes there, the caller's number or the name the operator
 * sent — written out where the number fits whole, two icons where it does not.
 */
export function MoveWays({
  number,
  name,
  testID,
  onPick,
}: {
  readonly number: string;
  readonly name: string;
  readonly testID: string;
  readonly onPick: (by: TMoveKey) => void;
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
        whole
        onOverflow={cramp}
        testID={`${testID}-number`}
        onPress={() => onPick('number')}
      />
      <Way
        key={`name-${String(shown)}`}
        icon={Type}
        label={name}
        shown={shown}
        whole={false}
        onOverflow={cramp}
        testID={`${testID}-name`}
        onPress={() => onPick('name')}
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
  /** The number takes what it needs, and gives way to the icons when the name would get too little. */
  fitted: { flexShrink: 1 },
  rest: { flex: 1, minWidth: NAME_MIN_WIDTH },
  iconOnly: { flexGrow: 1, flexBasis: 0, justifyContent: 'center' },
  label: { flexShrink: 1, fontSize: WAY_TEXT_SIZE, fontWeight: '600' },
  dimmed: { opacity: DIMMED_OPACITY },
});
