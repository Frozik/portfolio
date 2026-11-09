import { assert } from '@frozik/utils/assert/assert';
import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';

import type { CallsFilterApp } from '../contexts/shell/application/CallsFilterApp';

const AppContext = createContext<CallsFilterApp | null>(null);

export function AppProvider({
  app,
  children,
}: {
  readonly app: CallsFilterApp;
  readonly children: ReactNode;
}) {
  return <AppContext value={app}>{children}</AppContext>;
}

export function useApp(): CallsFilterApp {
  const app = useContext(AppContext);
  assert(app !== null, 'screens render inside the app');
  return app;
}
