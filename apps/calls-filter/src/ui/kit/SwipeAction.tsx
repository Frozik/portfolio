import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
// The row's own gesture claims the touches on Android: only Gesture Handler's button gets a tap there.
import { Pressable } from 'react-native-gesture-handler';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { usePalette } from '../theme/AppTheme';
import { ICON_SIZE, TOUCH_SIZE } from './metrics';

/** How far the row must travel before it stays open on the action. */
const OPEN_THRESHOLD = 48;
/** The row follows the finger at half its speed: a swipe is a decision, not a flick. */
const FRICTION = 2;

/** An action a swipe uncovers: an icon on its tone, its label read out. */
interface ISwipeAction {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly tone: 'danger' | 'accent' | 'caution';
  readonly testID: string;
  readonly onPress: () => void;
}

function ActionButton({
  action,
  swipeable,
}: {
  readonly action: ISwipeAction;
  readonly swipeable: SwipeableMethods;
}) {
  const palette = usePalette();
  const { icon: Icon } = action;
  return (
    <Pressable
      testID={action.testID}
      accessibilityRole="button"
      accessibilityLabel={action.label}
      onPress={() => {
        swipeable.close();
        action.onPress();
      }}
      style={[styles.action, { backgroundColor: palette[action.tone] }]}
    >
      <Icon color={palette.onAccent} size={ICON_SIZE} />
    </Pressable>
  );
}

/** A row that uncovers one action at its start when swiped right, and one at its end when swiped left. */
export function SwipeAction({
  start,
  end,
  children,
}: {
  readonly start?: ISwipeAction;
  readonly end?: ISwipeAction;
  readonly children: ReactNode;
}) {
  const palette = usePalette();
  return (
    <Swipeable
      friction={FRICTION}
      leftThreshold={OPEN_THRESHOLD}
      rightThreshold={OPEN_THRESHOLD}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={
        start === undefined
          ? undefined
          : (_progress, _translation, swipeable) => (
              <ActionButton action={start} swipeable={swipeable} />
            )
      }
      renderRightActions={
        end === undefined
          ? undefined
          : (_progress, _translation, swipeable) => (
              <ActionButton action={end} swipeable={swipeable} />
            )
      }
      childrenContainerStyle={{ backgroundColor: palette.bgCard }}
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  action: { width: TOUCH_SIZE + ICON_SIZE, alignItems: 'center', justifyContent: 'center' },
});
