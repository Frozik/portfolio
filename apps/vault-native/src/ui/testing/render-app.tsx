import type { Language } from '@frozik/utils/i18n/language';
import type { MockContextConfig } from 'expo-router/testing-library';
import { renderRouter } from 'expo-router/testing-library';
import type { ComponentProps, ReactNode } from 'react';

import type { TFollowIncomingFiles } from '@frozik/vault-app/cloud/domain/ports/vault-file-picker';
import { DiagnosticsModel } from '@frozik/vault-app/diagnostics/application/DiagnosticsModel';
import type { UpdateWatch } from '@frozik/vault-app/release/application/UpdateWatch';
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
    updates,
    followIncomingFiles,
    fileSavers,
  }: {
    readonly device?: ReturnType<typeof aDevice>;
    readonly initialUrl?: string;
    readonly language?: Language;
    /** The runtime's launch, with the vault a lock in the previous one left the note for. */
    readonly launch?: { readonly locked: string | null } | null;
    readonly updates?: UpdateWatch;
    readonly followIncomingFiles?: TFollowIncomingFiles;
    readonly fileSavers?: ComponentProps<typeof AppUnderTest>['fileSavers'];
  } = {}
) {
  const app = device.startStore();
  const diagnostics = new DiagnosticsModel(device.diagnostics, device.time.clock);
  const rendered = renderRouter(routes, {
    initialUrl,
    wrapper: ({ children }: { readonly children: ReactNode }) => (
      <AppUnderTest
        app={app}
        diagnostics={diagnostics}
        followIncomingFiles={followIncomingFiles}
        fileSavers={fileSavers}
        language={language}
        launch={launch}
        updates={updates}
      >
        {children}
      </AppUnderTest>
    ),
  });
  await rendered;
  jest.useRealTimers();
  return { getPathname: () => rendered.getPathname(), app, device, diagnostics };
}
