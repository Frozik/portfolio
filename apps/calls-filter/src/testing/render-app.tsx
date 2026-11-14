import { Stack } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import type { ComponentType } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CallsFilterApp } from '../contexts/shell/application/CallsFilterApp';
import { Boot } from '../ui/Boot';
import { unstable_settings } from '../ui/root-stack-settings';
import type { IFakePhone } from './fake-ports';
import { fakePhone } from './fake-ports';

const PHONE_FRAME = { x: 0, y: 0, width: 412, height: 915 };
const NO_INSETS = { top: 0, left: 0, right: 0, bottom: 0 };

/**
 * The app as the root layout starts it — the real models over a phone of fakes, its stack anchored
 * as the real one — with the given routes under Expo Router. `renderRouter` turns on fake timers for its own clock, which would
 * stall the models' async start, so real ones come back once it rendered.
 */
export async function renderApp(
  routes: Readonly<Record<string, ComponentType>>,
  {
    phone = fakePhone(),
    initialUrl = '/',
  }: { readonly phone?: IFakePhone; readonly initialUrl?: string } = {}
) {
  function TestLayout() {
    return (
      <SafeAreaProvider initialMetrics={{ frame: PHONE_FRAME, insets: NO_INSETS }}>
        <Boot start={() => CallsFilterApp.start(phone.ports)} stop={app => app.dispose()}>
          <Stack screenOptions={{ headerShown: false }} />
        </Boot>
      </SafeAreaProvider>
    );
  }
  const rendered = renderRouter(
    { _layout: { default: TestLayout, unstable_settings }, ...routes },
    { initialUrl }
  );
  await rendered;
  jest.useRealTimers();
  return { phone, getPathname: () => rendered.getPathname() };
}
