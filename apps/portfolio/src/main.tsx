import 'dockview/dist/styles/dockview.css';
import './styles/tailwind.css';
import './main.scss';

import { isNil } from 'lodash-es';
import { configure } from 'mobx';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { Application } from './app/components/Application';
import { RootStore, StoreProvider } from './app/stores';

configure({ enforceActions: 'always' });

const UPDATE_BANNER_DISPLAY_MS = 1500;

function showUpdateBanner(): void {
  const banner = document.createElement('div');
  Object.assign(banner.style, {
    position: 'fixed',
    top: '16px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: '99999',
    padding: '12px 24px',
    borderRadius: '8px',
    background: 'rgba(30, 30, 50, 0.95)',
    border: '1px solid rgba(100, 100, 255, 0.3)',
    color: '#e0e0e0',
    fontSize: '14px',
    fontFamily: 'system-ui, sans-serif',
    backdropFilter: 'blur(8px)',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.4)',
    opacity: '0',
    transition: 'opacity 300ms ease',
  });
  banner.textContent = 'New version detected, updating\u2026';
  document.body.appendChild(banner);
  requestAnimationFrame(() => {
    banner.style.opacity = '1';
  });
}

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
}

function bootstrap() {
  const container = document.getElementById('root');

  if (isNil(container)) {
    throw new Error(
      "Root element with ID 'root' was not found in the document. Ensure there is a corresponding HTML element with the ID 'root' in your HTML file."
    );
  }

  const rootStore = new RootStore();

  const root = createRoot(container);

  root.render(
    <StrictMode>
      <StoreProvider value={rootStore}>
        <Application />
      </StoreProvider>
    </StrictMode>
  );
}

bootstrap();
