import { lazy, memo, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { OverlayLoader } from '../../shared/components/OverlayLoader';
import { ErrorBoundary } from './ErrorBoundary';
import { InnerLayout } from './InnerLayout';
import { LandingLayout } from './LandingLayout';

const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '');

const Welcome = lazy(() =>
  import('../../features/welcome/presentation/Welcome').then(m => ({ default: m.Welcome }))
);
const Pendulum = lazy(() =>
  import('../../features/pendulum/presentation/Pendulum').then(m => ({ default: m.Pendulum }))
);
const Sudoku = lazy(() =>
  import('../../features/sudoku/presentation/Sudoku').then(m => ({ default: m.Sudoku }))
);
const Sun = lazy(() =>
  import('../../features/sun/presentation/Sun').then(m => ({ default: m.Sun }))
);
const Charts = lazy(() =>
  import('../../features/graphics/presentation/Charts').then(m => ({ default: m.Charts }))
);
const Timeseries = lazy(() =>
  import('../../features/timeseries/presentation/Timeseries').then(m => ({
    default: m.Timeseries,
  }))
);
const BinanceView = lazy(() =>
  import('../../features/binance-view/presentation/BinanceView').then(m => ({
    default: m.BinanceView,
  }))
);
const Stereometry = lazy(() =>
  import('../../features/stereometry/presentation/Stereometry').then(m => ({
    default: m.Stereometry,
  }))
);
const Controls = lazy(() =>
  import('../../features/controls/presentation/Controls').then(m => ({ default: m.Controls }))
);
const Retro = lazy(() =>
  import('../../features/retro/presentation/Retro').then(m => ({ default: m.Retro }))
);
const Lobby = lazy(() =>
  import('../../features/retro/presentation/Lobby').then(m => ({ default: m.Lobby }))
);
const Room = lazy(() =>
  import('../../features/retro/presentation/Room').then(m => ({ default: m.Room }))
);
const Conf = lazy(() =>
  import('../../features/conf/presentation/Conf').then(m => ({ default: m.Conf }))
);
const ConfLobby = lazy(() =>
  import('../../features/conf/presentation/ConfLobby').then(m => ({ default: m.ConfLobby }))
);
const ConfRoom = lazy(() =>
  import('../../features/conf/presentation/ConfRoom').then(m => ({ default: m.ConfRoom }))
);
const ErrorPage = lazy(() => import('./ErrorPage').then(m => ({ default: m.ErrorPage })));
const StoreBootstrap = lazy(() =>
  import('../stores/StoreBootstrap').then(m => ({ default: m.StoreBootstrap }))
);

const InnerRoot = () => (
  <StoreBootstrap>
    <InnerLayout />
  </StoreBootstrap>
);

export const Application = memo(() => {
  return (
    <BrowserRouter basename={BASENAME}>
      <ErrorBoundary>
        <Suspense fallback={<OverlayLoader />}>
          <Routes>
            <Route element={<LandingLayout />}>
              <Route index element={<Welcome />} />
            </Route>
            <Route element={<InnerRoot />}>
              <Route path="pendulum" element={<Pendulum />} />
              <Route path="sudoku/:puzzle?" element={<Sudoku />} />
              <Route path="sun" element={<Sun />} />
              <Route path="graphics" element={<Charts />} />
              <Route path="timeseries" element={<Timeseries />} />
              <Route path="binance" element={<BinanceView />} />
              <Route path="stereometry" element={<Stereometry />} />
              <Route path="controls" element={<Controls />} />
              <Route path="retro" element={<Retro />}>
                <Route index element={<Lobby />} />
                <Route path=":roomId" element={<Room />} />
              </Route>
              <Route path="conf" element={<Conf />}>
                <Route index element={<ConfLobby />} />
                <Route path=":roomId" element={<ConfRoom />} />
              </Route>
            </Route>
            <Route path="*" element={<ErrorPage />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
});
