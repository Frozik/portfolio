import { CircleCheck, CircleMinus } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import type { TAction } from '../../contexts/policy/domain/action';
import { actionTint, actionTone } from '../theme/action-tones';
import { useScheme } from '../theme/AppTheme';

const MARK_SIZE = 72;
const MARK_OPACITY = 0.13;
/** The mark runs off the row's end a little, a watermark rather than a button. */
const MARK_OVERHANG = -14;

/** What a group does with the calls it takes, behind its row: a faint tint and a large faint sign at the end. */
export function ActionBackdrop({
  action,
  testID,
}: {
  readonly action: TAction;
  readonly testID: string;
}) {
  const scheme = useScheme();
  const Mark = action === 'block' ? CircleMinus : CircleCheck;
  return (
    <View
      testID={testID}
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: actionTint(action, scheme) }]}
    >
      <View style={styles.mark}>
        <Mark color={actionTone(action, scheme)} size={MARK_SIZE} strokeWidth={1.5} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: {
    position: 'absolute',
    right: MARK_OVERHANG,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    opacity: MARK_OPACITY,
  },
});
