import './styles/tailwind.css';
import './main.scss';

import { isNil } from 'lodash-es';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { Application } from './app/components/Application';

const CLOUDFLARE_BEACON_SRC = 'https://static.cloudflareinsights.com/beacon.min.js';
const CLOUDFLARE_BEACON_TOKEN = '69d3e6095bfd4da3a3f4a48b99237a97';

function injectCloudflareBeacon(): void {
  const script = document.createElement('script');
  script.src = CLOUDFLARE_BEACON_SRC;
  script.defer = true;
  script.setAttribute('data-cf-beacon', JSON.stringify({ token: CLOUDFLARE_BEACON_TOKEN }));
  document.body.appendChild(script);
}

if (document.readyState === 'complete') {
  injectCloudflareBeacon();
} else {
  window.addEventListener('load', injectCloudflareBeacon, { once: true });
}

const UPDATE_BANNER_DISPLAY_MS = 1500;

const GEAR_SVG =
  '<svg class="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" ' +
  'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08' +
  'a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 ' +
  '1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25' +
  'a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25' +
  'a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 ' +
  '0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73' +
  'l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>' +
  '<circle cx="12" cy="12" r="3"/></svg>';

function showUpdateBanner(): void {
  const banner = document.createElement('div');
  banner.className =
    'fixed inset-x-0 top-0 z-[99999] flex items-center justify-center gap-2 ' +
    'py-3 text-sm font-sans bg-surface-elevated/95 text-text ' +
    'border-b border-brand-500/30 backdrop-blur-md shadow-lg animate-slide-in-top';
  banner.innerHTML = `${GEAR_SVG}<span>Updating\u2026</span>`;
  document.body.appendChild(banner);
}

const SW_UPDATE_CHECK_INTERVAL_MS = 300_000;

if ('serviceWorker' in navigator) {
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) {
      return;
    }
    reloading = true;
    showUpdateBanner();
    setTimeout(() => window.location.reload(), UPDATE_BANNER_DISPLAY_MS);
  });

  navigator.serviceWorker.ready.then(registration => {
    setInterval(() => registration.update(), SW_UPDATE_CHECK_INTERVAL_MS);
  });
}

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
