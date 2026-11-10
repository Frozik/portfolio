import { Pin } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import { useTexts } from '../../texts/use-texts';
import { usePalette } from '../theme/AppTheme';

const PIN_SIZE = 16;

/** Beside a name the app keeps itself: it can be neither renamed nor deleted. */
export function PinnedMark({ testID }: { readonly testID: string }) {
  const palette = usePalette();
  const texts = useTexts();
  return (
    <View testID={testID} accessible accessibilityLabel={texts.groups.pinned} style={styles.mark}>
      <Pin color={palette.fgDim} size={PIN_SIZE} />
    </View>
  );
}

const styles = StyleSheet.create({ mark: { alignSelf: 'center' } });
