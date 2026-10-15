import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { observer } from 'mobx-react-lite';

import { useAppModel } from '../app-model';
import { usePalette } from './AppTheme';

/**
 * The app's screens over the palette's backdrop: the navigator paints its own theme under every
 * screen, light unless told otherwise, and only a theme given inside the router reaches it.
 */
export const ThemedStack = observer(function ThemedStack() {
  const dark = useAppModel().app.appearance.scheme === 'dark';
  const palette = usePalette();
  const base = dark ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: palette.accent,
      background: palette.bg,
      card: palette.bgElevated,
      text: palette.fg,
      border: palette.line,
      notification: palette.danger,
    },
  };
  return (
    <ThemeProvider value={theme}>
      <Stack screenOptions={{ headerShown: false }} />
    </ThemeProvider>
  );
});
