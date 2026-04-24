import { memo } from 'react';
import { Outlet } from 'react-router-dom';

import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { BackgroundCanvas } from './BackgroundCanvas';
import { TopNav } from './TopNav';
import { TopNavBackProvider } from './TopNavBackContext';

/**
 * Layout for the landing route (`/`). Mounts the decorative background
 * layers (canvas + grain + vignette) and the sticky TopNav, then renders
 * the page content via `<Outlet />`. No sidebar here — landing has its
 * own anchor navigation.
 *
 * Stacking context (documented for the landing shell):
 *   z-0   — BackgroundCanvas (animated canvas)
 *   z-[1] — BackgroundCanvas grain + vignette overlays
 *   z-[2] — page content (main)
 *   z-50  — TopNav
 *   z-[100] — Modal backdrop / z-[110] — Modal panel (see Modal.tsx)
 */
export const LandingLayout = memo(() => {
  useDocumentTitle();

  return (
    <TopNavBackProvider>
      <BackgroundCanvas />
      <TopNav />
      <main className="relative z-[2]">
        <Outlet />
      </main>
    </TopNavBackProvider>
  );
});
