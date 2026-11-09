import { StyleSheet, View } from 'react-native';

import { DOT_SIZE } from './metrics';

export function Dot({ color }: { readonly color: string }) {
  return <View style={[styles.dot, { backgroundColor: color }]} />;
}

const styles = StyleSheet.create({
  dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2 },
});
