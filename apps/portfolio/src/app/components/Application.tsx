import { memo } from 'react';
import { BrowserRouter } from 'react-router-dom';

import { BASENAME } from '../basename';
import { OfflinePackProvider } from '../offline/OfflinePackContext';
import type { OfflinePackStore } from '../offline/OfflinePackStore';
import { ApplicationRoutes } from './ApplicationRoutes';

export const Application = memo(({ offlinePack }: { readonly offlinePack: OfflinePackStore }) => (
  <OfflinePackProvider value={offlinePack}>
    <BrowserRouter basename={BASENAME}>
      <ApplicationRoutes />
    </BrowserRouter>
  </OfflinePackProvider>
));
