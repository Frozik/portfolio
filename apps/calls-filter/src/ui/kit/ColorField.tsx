import { useRef, useState } from 'react';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';
import { PanResponder, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import type { IHsv } from '../theme/hsv';
import { hsvToHex } from '../theme/hsv';
import { RADIUS, SMALL_GAP } from './metrics';

const SQUARE_HEIGHT = 200;
const HUE_HEIGHT = 28;
const MARKER = 22;
const FULL_CIRCLE = 360;
const HUE_STOPS = [0, 60, 120, 180, 240, 300, 360] as const;

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** Follows a finger over an area, as fractions of its width and height; the area keeps the gesture. */
function useDrag(onDrag: (x: number, y: number) => void) {
  const size = useRef({ width: 1, height: 1 });
  const handler = useRef(onDrag);
  handler.current = onDrag;
  const report = (event: GestureResponderEvent) =>
    handler.current(
      clamp(event.nativeEvent.locationX / size.current.width),
      clamp(event.nativeEvent.locationY / size.current.height)
    );
  const [responder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: report,
      onPanResponderMove: report,
    })
  );
  const onLayout = (event: LayoutChangeEvent) => {
    size.current = event.nativeEvent.layout;
  };
  return { panHandlers: responder.panHandlers, onLayout };
}

/** The usual colour picker: saturation and brightness in a square, the hue on a strip under it. */
export function ColorField({
  value,
  onChange,
  testID,
}: {
  readonly value: IHsv;
  readonly onChange: (value: IHsv) => void;
  readonly testID: string;
}) {
  const [square, setSquare] = useState({ width: 0, height: SQUARE_HEIGHT });
  const squareDrag = useDrag((x, y) => onChange({ ...value, saturation: x, value: 1 - y }));
  const hueDrag = useDrag(x => onChange({ ...value, hue: x * FULL_CIRCLE }));
  const pureHue = hsvToHex({ hue: value.hue, saturation: 1, value: 1 });
  return (
    <View testID={testID} style={styles.field}>
      <View
        testID={`${testID}-square`}
        style={styles.square}
        {...squareDrag.panHandlers}
        onLayout={event => {
          squareDrag.onLayout(event);
          setSquare(event.nativeEvent.layout);
        }}
      >
        <Svg width="100%" height="100%" pointerEvents="none">
          <Defs>
            <LinearGradient id="white" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#ffffff" stopOpacity="1" />
              <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </LinearGradient>
            <LinearGradient id="black" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#000000" stopOpacity="0" />
              <Stop offset="1" stopColor="#000000" stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={pureHue} />
          <Rect width="100%" height="100%" fill="url(#white)" />
          <Rect width="100%" height="100%" fill="url(#black)" />
        </Svg>
        <View
          pointerEvents="none"
          style={[
            styles.marker,
            {
              left: value.saturation * square.width - MARKER / 2,
              top: (1 - value.value) * square.height - MARKER / 2,
              backgroundColor: hsvToHex(value),
            },
          ]}
        />
      </View>
      <View
        testID={`${testID}-hue`}
        style={styles.hue}
        {...hueDrag.panHandlers}
        onLayout={hueDrag.onLayout}
      >
        <Svg width="100%" height="100%" pointerEvents="none">
          <Defs>
            <LinearGradient id="hues" x1="0" y1="0" x2="1" y2="0">
              {HUE_STOPS.map(hue => (
                <Stop
                  key={hue}
                  offset={hue / FULL_CIRCLE}
                  stopColor={hsvToHex({ hue, saturation: 1, value: 1 })}
                />
              ))}
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" rx={HUE_HEIGHT / 2} fill="url(#hues)" />
        </Svg>
        <View
          pointerEvents="none"
          style={[
            styles.marker,
            styles.hueMarker,
            { left: `${(value.hue / FULL_CIRCLE) * 100}%`, backgroundColor: pureHue },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: SMALL_GAP * 2 },
  square: { height: SQUARE_HEIGHT, borderRadius: RADIUS, overflow: 'hidden' },
  hue: { height: HUE_HEIGHT },
  marker: {
    position: 'absolute',
    width: MARKER,
    height: MARKER,
    borderRadius: MARKER / 2,
    borderWidth: 3,
    borderColor: '#ffffff',
    elevation: 3,
  },
  hueMarker: { top: (HUE_HEIGHT - MARKER) / 2, marginLeft: -MARKER / 2 },
});
