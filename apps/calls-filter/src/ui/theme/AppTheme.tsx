import type { TNativePalette } from '@frozik/components/tokens/native-tokens';
import { NATIVE_PALETTES } from '@frozik/components/tokens/native-tokens';
import { StatusBar } from 'expo-status-bar';
import { setBackgroundColorAsync } from 'expo-system-ui';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect } from 'react';

export type TScheme = 'light' | 'dark';

const PaletteContext = createContext<TNativePalette>(NATIVE_PALETTES.light);
const SchemeContext = createContext<TScheme>('light');

/** The scheme for every screen below: palette, status bar icons, the window behind the app. */
export function AppTheme({
  scheme,
  children,
}: {
  readonly scheme: TScheme;
  readonly children: ReactNode;
}) {
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
}

export function usePalette(): TNativePalette {
  return useContext(PaletteContext);
}

export function useScheme(): TScheme {
  return useContext(SchemeContext);
}
