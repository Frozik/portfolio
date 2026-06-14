import type { TIdentityProvider } from '@frozik/communication-protocol/identity';
import { GoogleOAuthProvider, useGoogleOAuth } from '@react-oauth/google';
import { observer } from 'mobx-react-lite';
import type { ReactElement, ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo } from 'react';
import { AuthSession } from './AuthSession';
import type { IOidcProvider } from './oidc/IOidcProvider';
import { OIDC_PROVIDER_FACTORIES } from './oidc/oidc-provider-registry';

/**
 * Sentinel client_id passed to `<GoogleOAuthProvider>` when the env
 * var is missing. Lets the React tree mount even without a real
 * Google client; the `<SignInGate>` surfaces a clear error instead of
 * letting the WebSocket handshake silently 401.
 */
const FALLBACK_GOOGLE_CLIENT_ID = '__missing__';

interface ICommunicationContextValue {
  readonly authSession: AuthSession;
  readonly baseUrl: string;
  readonly googleClientId: string;
  readonly yandexClientId: string;
  readonly providers: ReadonlyMap<TIdentityProvider, IOidcProvider>;
}

const CommunicationContext = createContext<ICommunicationContextValue | null>(null);

/**
 * Wraps the React tree with the auth session + identity providers
 * needed by every retro / conf entry point. Both Google and Yandex
 * are optional; when their env-var-supplied client_id is empty, the
 * matching provider stays disabled (sign-in button hidden, server
 * rejects handshakes for that provider).
 */
export function CommunicationProvider({
  googleClientId,
  yandexClientId,
  baseUrl,
  children,
}: {
  readonly googleClientId: string;
  readonly yandexClientId: string;
  readonly baseUrl: string;
  readonly children: ReactNode;
}): ReactElement {
  const authSession = useMemo(() => new AuthSession(), []);

  const providers = useMemo<ReadonlyMap<TIdentityProvider, IOidcProvider>>(() => {
    const env = { googleClientId, yandexClientId };
    const map = new Map<TIdentityProvider, IOidcProvider>();
    for (const factory of OIDC_PROVIDER_FACTORIES) {
      if (factory.isConfigured(env)) {
        map.set(factory.id, factory.build(env));
      }
    }
    return map;
  }, [googleClientId, yandexClientId]);

  const value = useMemo<ICommunicationContextValue>(
    () => ({ authSession, baseUrl, googleClientId, yandexClientId, providers }),
    [authSession, baseUrl, googleClientId, yandexClientId, providers]
  );
  const effectiveClientId =
    googleClientId.trim().length === 0 ? FALLBACK_GOOGLE_CLIENT_ID : googleClientId;

  return (
    <GoogleOAuthProvider clientId={effectiveClientId}>
      <CommunicationContext.Provider value={value}>
        <ProviderBridge session={authSession} providers={providers} />
        {children}
      </CommunicationContext.Provider>
    </GoogleOAuthProvider>
  );
}

/**
 * Installs the silent-refresh runners on the session once the relevant
 * SDKs (Google's GIS) report ready. Also re-decodes the rehydrated
 * profile via the matching provider — `AuthSession` keeps decoding
 * generic so it doesn't grow per-provider claim logic.
 *
 * Must live inside `<GoogleOAuthProvider>` because `useGoogleOAuth`
 * is the only public surface that exposes script load state.
 */
const ProviderBridge = observer(
  ({
    session,
    providers,
  }: {
    readonly session: AuthSession;
    readonly providers: ReadonlyMap<TIdentityProvider, IOidcProvider>;
  }) => {
    const { scriptLoadedSuccessfully } = useGoogleOAuth();

    useEffect(() => {
      // Wait until GIS finishes loading when Google is enabled —
      // otherwise `GoogleOidcProvider.silentRefresh` would no-op anyway
      // because `window.google` isn't present yet.
      if (providers.has('google') && !scriptLoadedSuccessfully) {
        return undefined;
      }
      session.setProviders(providers);
      session.completeRehydrate();
      return () => {
        session.clearProviders();
      };
    }, [providers, scriptLoadedSuccessfully, session]);

    return null;
  }
);

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

export function useYandexClientId(): string {
  return useCommunicationContext().yandexClientId;
}

export function useOidcProviders(): ReadonlyMap<TIdentityProvider, IOidcProvider> {
  return useCommunicationContext().providers;
}
