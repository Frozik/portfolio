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
          handle: { title: 'CV' },
          lazy: async () => {
            const { Welcome } = await import('../../features/welcome/presentation/Welcome');
            return { Component: Welcome };
          },
        },
        {
          path: 'pendulum/:robotId?',
          handle: { title: 'Pendulum' },
          lazy: async () => {
            const { Pendulum } = await import('../../features/pendulum/presentation/Pendulum');
            return { Component: Pendulum };
          },
        },
        {
          path: 'sudoku/:puzzle?',
          handle: { title: 'Sudoku' },
          lazy: async () => {
            const { Sudoku } = await import('../../features/sudoku/presentation/Sudoku');
            return { Component: Sudoku };
          },
        },
        {
          path: 'sun',
          handle: { title: 'Sun' },
          lazy: async () => {
            const { Sun } = await import('../../features/sun/presentation/Sun');
            return { Component: Sun };
          },
        },
        {
          path: 'graphics',
          handle: { title: 'Graphics' },
          lazy: async () => {
            const { Charts } = await import('../../features/graphics/presentation/Charts');
            return { Component: Charts };
          },
        },
        {
          path: 'timeseries',
          handle: { title: 'Timeseries' },
          lazy: async () => {
            const { Timeseries } = await import(
              '../../features/timeseries/presentation/Timeseries'
            );
            return { Component: Timeseries };
          },
        },
        {
          path: 'controls',
          handle: { title: 'Controls' },
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
