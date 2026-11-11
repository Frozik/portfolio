import type { TNativePalette } from '@frozik/components/tokens/native-tokens';
import { StyleSheet, Text, View } from 'react-native';

import type {
  IPasswordStrength,
  TPasswordAdvice,
} from '@frozik/vault-app/keys/domain/master-password';
import { isWeak } from '@frozik/vault-app/keys/domain/master-password';

import { TEXT_SIZE } from '../kit/metrics';
import { useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';

const SEGMENTS = [0, 1, 2, 3] as const;
const SEGMENT_HEIGHT = 4;

/** The verdict's colour: a very weak password in red, a weak or fair one in yellow, a strong one plain. */
function verdictColor(strength: IPasswordStrength, palette: TNativePalette): string {
  if (strength.score === 0) {
    return palette.danger;
  }
  return isWeak(strength) ? palette.caution : palette.fgDim;
}

/** The zxcvbn verdict: a bar, its word and the offline attack time, and for a weak password the warning and what it lacks. */
export function StrengthBar({
  strength,
  advice,
}: {
  readonly strength: IPasswordStrength;
  readonly advice: readonly TPasswordAdvice[];
}) {
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
      <Text testID="strength" style={[styles.text, { color: verdictColor(strength, palette) }]}>
        {t.label}: {t.scores[strength.score]}. {t.crackTime(strength.offlineCrackTime)}
      </Text>
      {weak && <Text style={[styles.text, { color: palette.fgDim }]}>{t.weak}</Text>}
      {advice.length > 0 && (
        <View testID="strength-advice" style={styles.advice}>
          <Text style={[styles.text, { color: palette.fgDim }]}>{t.adviceTitle}</Text>
          {advice.map(item => (
            <Text
              key={item}
              testID={`strength-advice-${item}`}
              style={[styles.text, { color: palette.fgDim }]}
            >
              • {t.advice[item]}
            </Text>
          ))}
        </View>
      )}
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
  advice: { gap: 2 },
  text: { fontSize: TEXT_SIZE.caption },
});
