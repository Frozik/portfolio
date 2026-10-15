import type { TNativePalette } from '@frozik/components/tokens/native-tokens';
import { NATIVE_PALETTES } from '@frozik/components/tokens/native-tokens';
import { StatusBar } from 'expo-status-bar';
import { setBackgroundColorAsync } from 'expo-system-ui';
import { observer } from 'mobx-react-lite';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect } from 'react';

import type { AppearanceModel } from '@frozik/vault-app/device/application/AppearanceModel';
import type { TColorScheme } from '@frozik/vault-app/device/domain/theme';

const PaletteContext = createContext<TNativePalette>(NATIVE_PALETTES.light);
const SchemeContext = createContext<TColorScheme>('light');

/**
 * The scheme the device chose, for every screen below: the palette, the
 * status bar's icons and the window behind the app, which shows during a
 * transition and around an edge-to-edge screen.
 */
export const AppTheme = observer(function AppTheme({
  appearance,
  children,
}: {
  readonly appearance: AppearanceModel;
  readonly children: ReactNode;
}) {
  const { scheme } = appearance;
  const palette = NATIVE_PALETTES[scheme];
  useEffect(() => {
    void setBackgroundColorAsync(palette.bg);
  }, [palette]);
  return (
    <SchemeContext value={scheme}>
      <PaletteContext value={palette}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        {children}
      </PaletteContext>
    </SchemeContext>
  );
});

export function usePalette(): TNativePalette {
  return useContext(PaletteContext);
}

/** Light or dark, for the few colours that are not palette roles (a card's own colour). */
export function useScheme(): TColorScheme {
  return useContext(SchemeContext);
}
