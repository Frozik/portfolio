import { NATIVE_PALETTES } from '@frozik/components/tokens/native-tokens';
import { useTheme } from 'expo-router';
import { act, screen, waitFor } from 'expo-router/testing-library';
import { View } from 'react-native';

import { renderApp } from '../testing/render-app';
import { ThemedStack } from './ThemedStack';

function Backdrop() {
  const { colors } = useTheme();
  return <View testID="backdrop" style={{ backgroundColor: colors.background }} />;
}

describe('the theme behind every screen', () => {
  it('turns dark with the chosen scheme, not the navigator’s light default', async () => {
    const { app } = await renderApp({ _layout: () => <ThemedStack />, index: Backdrop });

    await act(() => app.appearance.choose('dark'));

    await waitFor(() =>
      expect(screen.getByTestId('backdrop')).toHaveStyle({
        backgroundColor: NATIVE_PALETTES.dark.bg,
      })
    );
  });
});
