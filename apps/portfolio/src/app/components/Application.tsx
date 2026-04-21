import { memo } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';

import { OverlayLoader } from '../../shared/components/OverlayLoader';
import { appT } from '../translations';
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
          handle: { title: appT.pageTitles.cv },
          lazy: async () => {
            const { Welcome } = await import('../../features/welcome/presentation/Welcome');
            return { Component: Welcome };
          },
        },
        {
          path: 'pendulum/:robotId?',
          handle: { title: appT.pageTitles.pendulum },
          lazy: async () => {
            const { Pendulum } = await import('../../features/pendulum/presentation/Pendulum');
            return { Component: Pendulum };
          },
        },
        {
          path: 'sudoku/:puzzle?',
          handle: { title: appT.pageTitles.sudoku },
          lazy: async () => {
            const { Sudoku } = await import('../../features/sudoku/presentation/Sudoku');
            return { Component: Sudoku };
          },
        },
        {
          path: 'sun',
          handle: { title: appT.pageTitles.sun },
          lazy: async () => {
            const { Sun } = await import('../../features/sun/presentation/Sun');
            return { Component: Sun };
          },
        },
        {
          path: 'graphics',
          handle: { title: appT.pageTitles.graphics },
          lazy: async () => {
            const { Charts } = await import('../../features/graphics/presentation/Charts');
            return { Component: Charts };
          },
        },
        {
          path: 'timeseries',
          handle: { title: appT.pageTitles.timeseries },
          lazy: async () => {
            const { Timeseries } = await import(
              '../../features/timeseries/presentation/Timeseries'
            );
            return { Component: Timeseries };
          },
        },
        {
          path: 'binance',
          handle: { title: appT.pageTitles.binance },
          lazy: async () => {
            const { BinanceView } = await import(
              '../../features/binance-view/presentation/BinanceView'
            );
            return { Component: BinanceView };
          },
        },
        {
          path: 'stereometry',
          handle: { title: appT.pageTitles.stereometry },
          lazy: async () => {
            const { Stereometry } = await import(
              '../../features/stereometry/presentation/Stereometry'
            );
            return { Component: Stereometry };
          },
        },
        {
          path: 'controls',
          handle: { title: appT.pageTitles.controls },
          lazy: async () => {
            const { Controls } = await import('../../features/controls/presentation/Controls');
            return { Component: Controls };
          },
        },
        {
          path: 'retro',
          handle: { title: appT.pageTitles.retro },
          lazy: async () => {
            const { Retro } = await import('../../features/retro/presentation/Retro');
            return { Component: Retro };
          },
          children: [
            {
              index: true,
              lazy: async () => {
                const { Lobby } = await import('../../features/retro/presentation/Lobby');
                return { Component: Lobby };
              },
            },
            {
              path: ':roomId',
              lazy: async () => {
                const { Room } = await import('../../features/retro/presentation/Room');
                return { Component: Room };
              },
            },
          ],
        },
      ],
    },
  ],
  { basename: BASENAME }
);

export const Application = memo(() => {
  return <RouterProvider router={rootRouter} />;
});
