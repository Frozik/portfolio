import { StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';

import { BASENAME } from '../basename';
import { ApplicationRoutes } from '../components/ApplicationRoutes';

/**
 * Build-time entry: the landing route as static markup, so the HTML paints
 * before any script runs and `main.tsx` only has to hydrate it. The tree is
 * the browser's own (`ApplicationRoutes`) under a static router, so the
 * markup React expects on hydration is exactly what is rendered here.
 */
export function renderLanding(): string {
  return renderToString(
    <StrictMode>
      <StaticRouter basename={BASENAME} location={`${BASENAME}/`}>
        <ApplicationRoutes />
      </StaticRouter>
    </StrictMode>
  );
}
