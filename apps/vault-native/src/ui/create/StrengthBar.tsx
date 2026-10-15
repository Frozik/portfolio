import { StyleSheet, Text, View } from 'react-native';

import type { IPasswordStrength } from '@frozik/vault-app/keys/domain/master-password';
import { isWeak } from '@frozik/vault-app/keys/domain/master-password';

import { TEXT_SIZE } from '../kit/metrics';
import { useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';

const SEGMENTS = [0, 1, 2, 3] as const;
const SEGMENT_HEIGHT = 4;

/** The zxcvbn verdict: a bar, its word, the offline attack time and the library's own advice. */
export function StrengthBar({ strength }: { readonly strength: IPasswordStrength }) {
  const palette = usePalette();
  const t = useVaultTexts().create.strength;
  const weak = isWeak(strength);
  return (
    <View accessibilityLiveRegion="polite" style={styles.meter}>
      <View style={styles.bar} importantForAccessibility="no-hide-descendants">
        {SEGMENTS.map(segment => (
          <View
            key={segment}
            style={[
              styles.segment,
              {
                backgroundColor:
                  segment < strength.score
                    ? weak
                      ? palette.caution
                      : palette.positive
                    : palette.lineSoft,
              },
            ]}
          />
        ))}
      </View>
      <Text testID="strength" style={[styles.text, { color: palette.fgDim }]}>
        {t.label}: {t.scores[strength.score]}. {t.crackTime(strength.offlineCrackTime)}
      </Text>
      {weak && <Text style={[styles.text, { color: palette.caution }]}>{t.weak}</Text>}
      {strength.warning !== null && (
        <Text style={[styles.text, { color: palette.fgFaint }]}>{strength.warning}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  meter: { gap: 6 },
  bar: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: SEGMENT_HEIGHT, borderRadius: SEGMENT_HEIGHT / 2 },
  text: { fontSize: TEXT_SIZE.caption },
});
