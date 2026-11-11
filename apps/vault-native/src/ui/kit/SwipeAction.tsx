import { isNil } from 'lodash-es';
import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
// The row's own gesture claims the touches on Android: only Gesture Handler's button gets a tap there.
import { Pressable } from 'react-native-gesture-handler';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Swipeable from 'react-native-gesture-handler/ReanimatedSwipeable';

import { usePalette } from '../theme/AppTheme';
import { TOUCH_SIZE } from './metrics';

const ICON_SIZE = 22;

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
  enabled = true,
  showing,
  children,
}: {
  readonly start?: ISwipeAction;
  readonly end?: ISwipeAction;
  /** Off while the row is busy with something else: it does not move under the finger. */
  readonly enabled?: boolean;
  /** What the row shows: a list reuses its rows, and one given something else comes back closed. */
  readonly showing?: string;
  readonly children: ReactNode;
}) {
  const palette = usePalette();
  const swipeable = useRef<SwipeableMethods>(null);
  /**
   * The actions are drawn once a swipe starts, an empty place of their width until then: a long
   * list rebinds its rows as it scrolls, and hidden icons would cost every time.
   */
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    swipeable.current?.reset();
    setRevealed(false);
  }, [showing]);
  return (
    <Swipeable
      ref={swipeable}
      testID="swipe-row"
      onSwipeableOpenStartDrag={() => setRevealed(true)}
      onSwipeableClose={() => setRevealed(false)}
      enabled={enabled}
      friction={FRICTION}
      leftThreshold={OPEN_THRESHOLD}
      rightThreshold={OPEN_THRESHOLD}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={
        isNil(start)
          ? undefined
          : (_progress, _translation, methods) =>
              revealed ? (
                <ActionButton action={start} swipeable={methods} />
              ) : (
                <View style={styles.action} />
              )
      }
      renderRightActions={
        isNil(end)
          ? undefined
          : (_progress, _translation, methods) =>
              revealed ? (
                <ActionButton action={end} swipeable={methods} />
              ) : (
                <View style={styles.action} />
              )
      }
      childrenContainerStyle={{ backgroundColor: palette.bg }}
    >
      {children}
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  action: { width: TOUCH_SIZE + ICON_SIZE, alignItems: 'center', justifyContent: 'center' },
});
