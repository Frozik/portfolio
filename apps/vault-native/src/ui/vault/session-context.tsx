import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';
import type { ReactNode } from 'react';
import { createContext, useContext } from 'react';

import type { VaultSession } from '@frozik/vault-app/session/application/VaultSession';

const SessionContext = createContext<VaultSession | null>(null);

/** The open vault's session for the pages below its frame. */
export function SessionProvider({
  session,
  children,
}: {
  readonly session: VaultSession;
  readonly children: ReactNode;
}) {
  return <SessionContext value={session}>{children}</SessionContext>;
}

export function useSession(): VaultSession {
  const session = useContext(SessionContext);
  assert(!isNil(session), 'useSession is used outside an open vault');
  return session;
}
