import { memo } from 'react';
import { Outlet } from 'react-router-dom';

import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { TopNav } from './TopNav';
import { TopNavBackProvider } from './TopNavBackContext';

/**
 * Layout for inner demo routes (pendulum, sudoku, sun, …).
 * Uses a flex column so the TopNav occupies its natural height and the
 * demo `<main>` takes whatever vertical space remains. The viewport is
 * locked to 100dvh × 100dvw and the main scroll-container is `flex-1` —
 * each demo therefore receives a fixed-size stage matching `viewport −
 * topnav` without any magic-number paddings.
 */
export const InnerLayout = memo(() => {
  useDocumentTitle();

  return (
    <TopNavBackProvider>
      <div className="flex h-dvh w-dvw flex-col overflow-hidden">
        <TopNav variant="inner" />
        <main className="relative min-h-0 flex-1 overflow-auto bg-black">
          <Outlet />
        </main>
      </div>
    </TopNavBackProvider>
  );
});
