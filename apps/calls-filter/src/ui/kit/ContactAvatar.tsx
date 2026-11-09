import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import { usePalette } from '../theme/AppTheme';
import { TEXT_SIZE } from './metrics';

const AVATAR_SIZE = 36;

/** The contact's own photo, as the contacts app shows it; without one, the first letter of the name. */
export function ContactAvatar({
  photoUri,
  name,
}: {
  readonly photoUri: string | null;
  readonly name: string;
}) {
  const palette = usePalette();
  const [failed, setFailed] = useState(false);
  if (photoUri !== null && !failed) {
    return (
      <Image
        source={{ uri: photoUri }}
        onError={() => setFailed(true)}
        style={styles.avatar}
        accessibilityIgnoresInvertColors
      />
    );
  }
  return (
    <View style={[styles.avatar, { backgroundColor: palette.accentSoft }]}>
      <Text style={[styles.initial, { color: palette.accent }]}>
        {name.trim().charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initial: { fontSize: TEXT_SIZE.body, fontWeight: '700' },
});
