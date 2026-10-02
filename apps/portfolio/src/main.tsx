import './styles/tailwind.css';

import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';

import { BASENAME } from './app/basename';
import { setupCloudflareBeacon } from './app/bootstrap/cloudflareBeacon';
import { selectRootContainer, shouldHydrate } from './app/bootstrap/root-container';
import { setupServiceWorkerUpdate } from './app/bootstrap/serviceWorkerUpdate';
import { Application } from './app/components/Application';
import { bootstrapOfflinePack } from './app/offline/bootstrapOfflinePack';
import { createServiceWorkerOfflinePackPort } from './app/offline/offlinePackPort';
import { getCurrentLanguage } from './shared/i18n/locale';

setupCloudflareBeacon();
setupServiceWorkerUpdate();
const offlinePack = bootstrapOfflinePack(createServiceWorkerOfflinePackPort());

function bootstrap() {
  const container = selectRootContainer(document, getCurrentLanguage());
  const application = (
    <StrictMode>
      <Application offlinePack={offlinePack} />
    </StrictMode>
  );

  if (shouldHydrate(container, window.location.pathname, BASENAME)) {
    hydrateRoot(container.element, application);
    return;
  }

  container.element.replaceChildren();
  createRoot(container.element).render(application);
}

bootstrap();
