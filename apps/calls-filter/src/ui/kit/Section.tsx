import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { usePalette } from '../theme/AppTheme';
import { RADIUS, SMALL_GAP, TEXT_SIZE } from './metrics';

/** A titled card of rows. */
export function Section({
  title,
  actions,
  children,
  testID,
}: {
  readonly title?: string;
  /** Icon buttons at the end of the title line: what adds to this card. */
  readonly actions?: ReactNode;
  readonly children: ReactNode;
  readonly testID?: string;
}) {
  const palette = usePalette();
  return (
    <View testID={testID} style={styles.section}>
      {title === undefined ? null : (
        <View style={styles.titleLine}>
          <Text style={[styles.title, { color: palette.fgDim }]}>{title.toUpperCase()}</Text>
          {actions === undefined ? null : <View style={styles.actions}>{actions}</View>}
        </View>
      )}
      <View
        style={[styles.card, { backgroundColor: palette.bgCard, borderColor: palette.lineSoft }]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: SMALL_GAP },
  titleLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row' },
  title: { fontSize: TEXT_SIZE.caption, fontWeight: '700', letterSpacing: 0.6 },
  card: { borderRadius: RADIUS, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
});
