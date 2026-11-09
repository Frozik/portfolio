import type { ReactNode } from 'react';
import { createContext, useContext, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { usePalette } from '../theme/AppTheme';
import { GAP, GUTTER, RADIUS, SMALL_GAP, TEXT_SIZE } from './metrics';

/** Where the held control is on screen, as `measureInWindow` reports it. */
interface IAnchor {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

interface IHint {
  readonly anchor: IAnchor;
  readonly title: string;
  readonly text: string;
}

interface IHoldHints {
  readonly show: (hint: IHint) => void;
  readonly hide: () => void;
}

const MAX_WIDTH = 300;
/** Above the control when this much room is left there, else below it. */
const ROOM_ABOVE = 140;

const HoldHintsContext = createContext<IHoldHints | null>(null);

export function useHoldHints(): IHoldHints {
  const hints = useContext(HoldHintsContext);
  if (hints === null) {
    throw new Error('useHoldHints needs a HoldHintLayer above it');
  }
  return hints;
}

/**
 * Hints drawn over the screens in the app's own window: a Modal would be a second window, take
 * the finger's release, and the hint would outlive the hold.
 */
export function HoldHintLayer({ children }: { readonly children: ReactNode }) {
  const palette = usePalette();
  const window = useWindowDimensions();
  const [hint, setHint] = useState<IHint | null>(null);
  const [hints] = useState<IHoldHints>(() => ({ show: setHint, hide: () => setHint(null) }));
  const width = Math.min(MAX_WIDTH, window.width - 2 * GUTTER);
  return (
    <HoldHintsContext.Provider value={hints}>
      <View style={styles.layer}>
        {children}
        {hint === null ? null : (
          <View
            pointerEvents="none"
            testID="hold-hint"
            style={[
              styles.hint,
              hint.anchor.y >= ROOM_ABOVE
                ? { bottom: window.height - hint.anchor.y + SMALL_GAP }
                : { top: hint.anchor.y + hint.anchor.height + SMALL_GAP },
              {
                left: Math.min(
                  Math.max(hint.anchor.x + hint.anchor.width / 2 - width / 2, GUTTER),
                  window.width - width - GUTTER
                ),
                width,
                backgroundColor: palette.fg,
              },
            ]}
          >
            <Text style={[styles.title, { color: palette.bg }]}>{hint.title}</Text>
            <Text style={[styles.text, { color: palette.bg }]}>{hint.text}</Text>
          </View>
        )}
      </View>
    </HoldHintsContext.Provider>
  );
}

const styles = StyleSheet.create({
  layer: { flex: 1 },
  hint: {
    position: 'absolute',
    padding: GAP,
    gap: SMALL_GAP / 2,
    borderRadius: RADIUS,
    elevation: 6,
  },
  title: { fontSize: TEXT_SIZE.body, fontWeight: '700' },
  text: { fontSize: TEXT_SIZE.small },
});
