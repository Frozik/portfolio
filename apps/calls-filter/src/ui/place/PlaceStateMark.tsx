import { MapPin, MapPinCheckInside, MapPinXInside } from 'lucide-react-native';
import { View } from 'react-native';

import { ICON_SIZE } from '../kit/metrics';
import { usePalette } from '../theme/AppTheme';

/** Whether the phone is at a place, at a glance: a ticked pin, a crossed one, or a faint one. */
export function PlaceStateMark({ here }: { readonly here: boolean | null }) {
  const palette = usePalette();
  if (here === null) {
    return (
      <View testID="place-state-unknown">
        <MapPin color={palette.fgFaint} size={ICON_SIZE} />
      </View>
    );
  }
  return here ? (
    <View testID="place-state-at">
      <MapPinCheckInside color={palette.accent} size={ICON_SIZE} />
    </View>
  ) : (
    <View testID="place-state-away">
      <MapPinXInside color={palette.fgDim} size={ICON_SIZE} />
    </View>
  );
}
