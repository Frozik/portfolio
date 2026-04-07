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
