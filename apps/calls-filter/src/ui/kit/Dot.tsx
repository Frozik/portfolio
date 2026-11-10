import { StyleSheet, View } from 'react-native';

import { DOT_SIZE } from './metrics';

const RING_WIDTH = 3;

/** A group's colour; a ring — a dot with a hole — while the group is switched off. */
export function Dot({
  color,
  hollow = false,
  testID,
}: {
  readonly color: string;
  readonly hollow?: boolean;
  readonly testID?: string;
}) {
  return (
    <View
      testID={testID}
      style={[
        styles.dot,
        hollow ? { borderWidth: RING_WIDTH, borderColor: color } : { backgroundColor: color },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2 },
});
