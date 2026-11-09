import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { SMALL_GAP } from './metrics';

/** Chips in rows that wrap. */
export function Wrap({ children }: { readonly children: ReactNode }) {
  return <View style={styles.wrap}>{children}</View>;
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: SMALL_GAP + 2 },
});
