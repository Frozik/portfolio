import { memo } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import { OverlayLoader } from '../../shared/components/OverlayLoader';
import { ErrorPage } from './ErrorPage';
import { Root } from './Root';

const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '');

const rootRouter = createBrowserRouter(
  [
    {
      path: '/',
      element: <Root />,
      errorElement: <ErrorPage />,
      hydrateFallbackElement: <OverlayLoader />,
      children: [
        {
          index: true,
          lazy: async () => {
            const { Welcome } = await import('../../features/welcome/presentation/Welcome');
            return { Component: Welcome };
          },
        },
        {
          path: 'pendulum/:robotId?',
          lazy: async () => {
            const { Pendulum } = await import('../../features/pendulum/presentation/Pendulum');
            return { Component: Pendulum };
          },
        },
        {
          path: 'sudoku/:puzzle?',
          lazy: async () => {
            const { Sudoku } = await import('../../features/sudoku/presentation/Sudoku');
            return { Component: Sudoku };
          },
        },
        {
          path: 'sun',
          lazy: async () => {
            const { Sun } = await import('../../features/sun/presentation/Sun');
            return { Component: Sun };
          },
        },
        {
          path: 'graphics',
          lazy: async () => {
            const { Charts } = await import('../../features/webgpu-graphics/presentation/Charts');
            return { Component: Charts };
          },
        },
        {
          path: 'controls',
          lazy: async () => {
            const { Controls } = await import('../../features/controls/presentation/Controls');
            return { Component: Controls };
          },
        },
      ],
    },
  ],
  { basename: BASENAME }
);

export const Application = memo(() => {
  return <RouterProvider router={rootRouter} />;
});
