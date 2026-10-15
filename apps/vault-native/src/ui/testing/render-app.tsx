import type { Language } from '@frozik/utils/i18n/language';
import type { MockContextConfig } from 'expo-router/testing-library';
import { renderRouter } from 'expo-router/testing-library';
import type { ReactNode } from 'react';

import { aDevice } from '@frozik/vault-app/testing/fake-device';

import { AppUnderTest } from './AppUnderTest';

/**
 * The screens under Expo Router over a phone of fakes: real models, real
 * navigation. `renderRouter` turns on fake timers for its own clock, which
 * would stall the models' async work, so real ones come back once it rendered.
 */
export async function renderApp(
  routes: MockContextConfig,
  {
    device = aDevice(),
    initialUrl = '/',
    language = 'en',
    launch = null,
  }: {
    readonly device?: ReturnType<typeof aDevice>;
    readonly initialUrl?: string;
    readonly language?: Language;
    /** The runtime's launch, with the vault a lock in the previous one left the note for. */
    readonly launch?: { readonly locked: string | null } | null;
  } = {}
) {
  const app = device.startStore();
  const rendered = renderRouter(routes, {
    initialUrl,
    wrapper: ({ children }: { readonly children: ReactNode }) => (
      <AppUnderTest app={app} language={language} launch={launch}>
        {children}
      </AppUnderTest>
    ),
  });
  await rendered;
  jest.useRealTimers();
  return { getPathname: () => rendered.getPathname(), app, device };
}
