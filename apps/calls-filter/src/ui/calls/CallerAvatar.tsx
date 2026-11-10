import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { TEXT_SIZE } from '../kit/metrics';
import { usePalette } from '../theme/AppTheme';

const AVATAR_SIZE = 40;
const RING_WIDTH = 2;
const INNER_SIZE = AVATAR_SIZE - RING_WIDTH * 2;
/** What the circle shows of a caller with no name at all. */
const NO_NAME = '?';

/**
 * Every caller's avatar: the contact's photo, or a grey circle with the first letter of whatever
 * name the call carries — a question mark without one — inside a ring of what became of the call.
 */
export function CallerAvatar({
  photoUri,
  name,
  ring,
  testID,
}: {
  readonly photoUri: string | null;
  readonly name: string | null;
  readonly ring: 'positive' | 'danger' | 'accent';
  readonly testID: string;
}) {
  const palette = usePalette();
  const [failed, setFailed] = useState(false);
  const initial = name?.trim().charAt(0).toUpperCase() || NO_NAME;
  return (
    <View testID={testID} style={[styles.ring, { borderColor: palette[ring] }]}>
      {photoUri !== null && !failed ? (
        <Image
          source={{ uri: photoUri }}
          onError={() => setFailed(true)}
          style={styles.inner}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={[styles.inner, { backgroundColor: palette.fgFaint }]}>
          <Text style={[styles.initial, { color: palette.bg }]}>{initial}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: RING_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    width: INNER_SIZE,
    height: INNER_SIZE,
    borderRadius: INNER_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initial: { fontSize: TEXT_SIZE.body, fontWeight: '700' },
});
