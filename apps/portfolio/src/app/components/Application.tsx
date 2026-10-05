import { memo } from 'react';
import { BrowserRouter } from 'react-router-dom';

import { BASENAME } from '../basename';
import { useAppReadyMarker } from '../hooks/useAppReadyMarker';
import { OfflinePackProvider } from '../offline/OfflinePackContext';
import type { OfflinePackStore } from '../offline/OfflinePackStore';
import { ApplicationRoutes } from './ApplicationRoutes';

export const Application = memo(({ offlinePack }: { readonly offlinePack: OfflinePackStore }) => {
  useAppReadyMarker();
  return (
    <OfflinePackProvider value={offlinePack}>
      <BrowserRouter basename={BASENAME}>
        <ApplicationRoutes />
      </BrowserRouter>
    </OfflinePackProvider>
  );
});
