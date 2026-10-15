import './styles/app.css';

import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';

const container = document.getElementById('root');
assert(!isNil(container), 'index.html carries the #root element');
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
