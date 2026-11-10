import { Funnel } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useTexts } from '../../texts/use-texts';
import { usePalette } from '../theme/AppTheme';

const FUNNEL_SIZE = 14;

/** Beside the name of a group that acts only under its conditions. */
export function ConditionsMark({ testID }: { readonly testID: string }) {
  const palette = usePalette();
  const texts = useTexts();
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={texts.groups.conditioned}
      style={styles.mark}
    >
      <Funnel color={palette.fgDim} size={FUNNEL_SIZE} />
    </View>
  );
}

const styles = StyleSheet.create({ mark: { alignSelf: 'center' } });
