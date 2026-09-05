import { memo } from 'react';
import { Outlet } from 'react-router-dom';

import { CommunicationProvider } from '../../shared/communication/CommunicationProvider';

const GOOGLE_OAUTH_CLIENT_ID = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID ?? '';
const YANDEX_OAUTH_CLIENT_ID = import.meta.env.VITE_YANDEX_OAUTH_CLIENT_ID ?? '';
const COMMUNICATION_BASE_URL = import.meta.env.VITE_COMMUNICATION_URL ?? 'http://localhost:4445';

/**
 * Pathless layout route shared by the routes that talk to the signaling
 * server (retro, conf). Mounting the auth session and the OIDC SDKs here —
 * and not at the application root — keeps Google Identity Services, MobX
 * and the OIDC providers off every other page's critical path.
 */
const CommunicationRootComponent = () => (
  <CommunicationProvider
    googleClientId={GOOGLE_OAUTH_CLIENT_ID}
    yandexClientId={YANDEX_OAUTH_CLIENT_ID}
    baseUrl={COMMUNICATION_BASE_URL}
  >
    <Outlet />
  </CommunicationProvider>
);

export const CommunicationRoot = memo(CommunicationRootComponent);
