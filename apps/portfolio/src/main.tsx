import './styles/tailwind.css';

import { isNil } from 'lodash-es';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { setupCloudflareBeacon } from './app/bootstrap/cloudflareBeacon';
import { setupServiceWorkerUpdate } from './app/bootstrap/serviceWorkerUpdate';
import { Application } from './app/components/Application';

setupCloudflareBeacon();
setupServiceWorkerUpdate();

function bootstrap() {
  const container = document.getElementById('root');

  if (isNil(container)) {
    throw new Error(
      "Root element with ID 'root' was not found in the document. Ensure there is a corresponding HTML element with the ID 'root' in your HTML file."
    );
  }

  const root = createRoot(container);

  root.render(
    <StrictMode>
      <Application />
    </StrictMode>
  );
}

bootstrap();
