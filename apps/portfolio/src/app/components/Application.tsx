import { memo } from 'react';
import { BrowserRouter } from 'react-router-dom';

import { BASENAME } from '../basename';
import { ApplicationRoutes } from './ApplicationRoutes';

export const Application = memo(() => {
  return (
    <BrowserRouter basename={BASENAME}>
      <ApplicationRoutes />
    </BrowserRouter>
  );
});
