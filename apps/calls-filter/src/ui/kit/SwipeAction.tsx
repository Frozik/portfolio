import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
// The row's own gesture claims the touches on Android: only Gesture Handler's button gets a tap there.
import { Pressable } from 'react-native-gesture-handler';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { usePalette } from '../theme/AppTheme';
import { ICON_SIZE, TOUCH_SIZE } from './metrics';

/** How far the row must travel before it stays open on the action. */
const OPEN_THRESHOLD = 48;
/** The row follows the finger at half its speed: a swipe is a decision, not a flick. */
const FRICTION = 2;

/** A row that, swiped to the right, uncovers one destructive action at its start: an icon, its label read out. */
export function SwipeAction({
  icon: Icon,
  label,
  testID,
  onPress,
  children,
}: {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly testID: string;
  readonly onPress: () => void;
  readonly children: ReactNode;
}) {
  const palette = usePalette();
  return (
    <Swipeable
      friction={FRICTION}
      leftThreshold={OPEN_THRESHOLD}
      overshootLeft={false}
      renderLeftActions={(_progress, _translation, swipeable) => (
        <Pressable
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={() => {
            swipeable.close();
            onPress();
          }}
          style={[styles.action, { backgroundColor: palette.danger }]}
        >
          <Icon color={palette.onAccent} size={ICON_SIZE} />
        </Pressable>
      )}
      childrenContainerStyle={{ backgroundColor: palette.bgCard }}
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  action: { width: TOUCH_SIZE + ICON_SIZE, alignItems: 'center', justifyContent: 'center' },
});
