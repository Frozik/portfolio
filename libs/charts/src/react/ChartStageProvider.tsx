import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';

import type { IStageOptions, Stage } from '../core/stage/stage';
import { createStage } from '../core/stage/stage';
import { rafScheduler } from '../dom/raf-scheduler';

/** `failed` covers both a stage that could not be created and one whose device was lost later. */
export type TChartStageState =
  | { readonly status: 'initializing' }
  | { readonly status: 'ready'; readonly stage: Stage }
  | { readonly status: 'failed'; readonly error: unknown };

const INITIALIZING: TChartStageState = { status: 'initializing' };

const ChartStageContext = createContext<TChartStageState>(INITIALIZING);

/** The stage the charts below are drawn on; what to show while it is not ready is the application's business. */
export function useChartStage(): TChartStageState {
  return useContext(ChartStageContext);
}

/**
 * Creates one stage for every chart below it and destroys it on unmount.
 * `backends` is called once per mount: it is where a GPU device is asked for,
 * which must not happen during render.
 */
export function ChartStageProvider({
  backends,
  children,
}: {
  readonly backends: () => IStageOptions['backends'];
  readonly children: ReactNode;
}): ReactNode {
  const [state, setState] = useState<TChartStageState>(INITIALIZING);

  useEffect(() => {
    let unmounted = false;
    let created: Stage | undefined;
    const fail = (error: unknown): void => {
      if (!unmounted) {
        setState({ status: 'failed', error });
      }
    };

    void createStage({ backends: backends(), scheduler: rafScheduler }).then(stage => {
      if (unmounted) {
        stage.destroy();
        return;
      }
      created = stage;
      setState({ status: 'ready', stage });
      void stage.lost.then(reason => fail(new Error(reason)));
    }, fail);

    return () => {
      unmounted = true;
      created?.destroy();
      setState(INITIALIZING);
    };
  }, [backends]);

  return <ChartStageContext value={state}>{children}</ChartStageContext>;
}
