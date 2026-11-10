import { useState } from 'react';
import type { ComponentProps } from 'react';
import type { TextLayoutEvent } from 'react-native';
import { StyleSheet, Text } from 'react-native';

import { splitsWord } from './split-word';

const SHRINK_STEP = 0.92;
const MIN_SCALE = 0.7;

/**
 * The font scale shared by labels that read as one (the segments of a switch): it steps down while
 * any of them breaks a word, and starts again from full size when the labels change.
 */
export function useWordFit(labels: string): {
  readonly scale: number;
  readonly shrink: () => void;
} {
  const [fit, setFit] = useState({ labels, scale: 1 });
  const scale = fit.labels === labels ? fit.scale : 1;
  const shrink = () => {
    const smaller = scale * SHRINK_STEP;
    if (smaller >= MIN_SCALE) {
      setFit({ labels, scale: smaller });
    }
  };
  return { scale, shrink };
}

/**
 * A label that wraps only between words: on a narrow phone or with a large system font, a word too
 * wide for its line asks for a smaller font instead of breaking in the middle.
 */
export function WholeWordsText({
  fit,
  style,
  ...props
}: Omit<ComponentProps<typeof Text>, 'onTextLayout'> & {
  readonly fit: ReturnType<typeof useWordFit>;
}) {
  const fontSize = StyleSheet.flatten(style)?.fontSize;
  const shrinkWhenSplit = (event: TextLayoutEvent) => {
    if (splitsWord(event.nativeEvent.lines)) {
      fit.shrink();
    }
  };
  return (
    <Text
      {...props}
      style={[style, fontSize === undefined ? null : { fontSize: fontSize * fit.scale }]}
      onTextLayout={shrinkWhenSplit}
    />
  );
}
