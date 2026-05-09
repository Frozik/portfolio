import { GoogleOAuthProvider, useGoogleOAuth } from '@react-oauth/google';
import { observer } from 'mobx-react-lite';
import type { ReactElement, ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo } from 'react';

import { AuthSession } from './AuthSession';
import { requestGoogleSilentRefresh } from './googleSilentRefresh';

interface ICommunicationContextValue {
  readonly authSession: AuthSession;
  readonly baseUrl: string;
  readonly googleClientId: string;
}

const CommunicationContext = createContext<ICommunicationContextValue | null>(null);

interface ICommunicationProviderProps {
  readonly googleClientId: string;
  readonly baseUrl: string;
  readonly children: ReactNode;
}

const FALLBACK_GOOGLE_CLIENT_ID = '__missing__';

/**
 * Wraps the React tree with the auth session + Google identity
 * provider needed by every retro / conf entry point.
 *
 * If `googleClientId` is empty the inner Google provider is given
 * a sentinel value so its components can render — the
 * `<SignInGate>` will surface a clear error rather than silently
 * 401-ing on the WebSocket handshake.
 */
export function CommunicationProvider({
  googleClientId,
  baseUrl,
  children,
}: ICommunicationProviderProps): ReactElement {
  const authSession = useMemo(() => new AuthSession(), []);
  const value = useMemo<ICommunicationContextValue>(
    () => ({ authSession, baseUrl, googleClientId }),
    [authSession, baseUrl, googleClientId]
  );
  const effectiveClientId =
    googleClientId.trim().length === 0 ? FALLBACK_GOOGLE_CLIENT_ID : googleClientId;

  return (
    <GoogleOAuthProvider clientId={effectiveClientId}>
      <CommunicationContext.Provider value={value}>
        <SilentRefreshBridge session={authSession} clientId={effectiveClientId} />
        {children}
      </CommunicationContext.Provider>
    </GoogleOAuthProvider>
  );
}

interface ISilentRefreshBridgeProps {
  readonly session: AuthSession;
  readonly clientId: string;
}

/**
 * Installs the silent ID-token refresh handler on the session once
 * the Google Identity Services script reports `scriptLoadedSuccessfully`.
 * Re-registers whenever the signed-in account changes so the GIS
 * `login_hint` follows the active profile email — without this, a
 * refresh after a Google account switch would race against the wrong
 * Google session.
 *
 * Must be a child of `<GoogleOAuthProvider>` because `useGoogleOAuth`
 * is the only public surface that exposes script load state.
 */
const SilentRefreshBridge = observer(({ session, clientId }: ISilentRefreshBridgeProps) => {
  const { scriptLoadedSuccessfully } = useGoogleOAuth();
  const loginHint = session.profile?.email;

  useEffect(() => {
    if (!scriptLoadedSuccessfully) {
      return undefined;
    }
    if (clientId.trim().length === 0 || clientId === FALLBACK_GOOGLE_CLIENT_ID) {
      return undefined;
    }
    session.setRefreshHandler(() => requestGoogleSilentRefresh({ clientId, loginHint }));
    return () => {
      session.clearRefreshHandler();
    };
  }, [scriptLoadedSuccessfully, clientId, loginHint, session]);

  return null;
});

function useCommunicationContext(): ICommunicationContextValue {
  const context = useContext(CommunicationContext);
  if (context === null) {
    throw new Error(
      'communication-provider/missing: components reading the communication ' +
        'context must be rendered inside <CommunicationProvider>'
    );
  }
  return context;
}

export function useAuthSession(): AuthSession {
  return useCommunicationContext().authSession;
}

export function useCommunicationBaseUrl(): string {
  return useCommunicationContext().baseUrl;
}

export function useGoogleClientId(): string {
  return useCommunicationContext().googleClientId;
}
