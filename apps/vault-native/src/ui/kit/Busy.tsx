import { ActivityIndicator } from 'react-native';

import { usePalette } from '../theme/AppTheme';

export function Busy({ label }: { readonly label: string }) {
  const palette = usePalette();
  return <ActivityIndicator accessibilityLabel={label} color={palette.accent} />;
}
