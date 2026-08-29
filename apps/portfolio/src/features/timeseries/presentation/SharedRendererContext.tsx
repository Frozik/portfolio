import { isNil } from 'lodash-es';
import type { ReactNode } from 'react';
import { createContext, memo, useContext, useEffect, useState } from 'react';
import { createSharedRenderer } from '../application/render/shared-renderer';
import type { ISharedTimeseriesRenderer } from '../application/render/types';

export type TSharedRendererState =
  | { readonly status: 'initializing'; readonly renderer: null }
  | { readonly status: 'ready'; readonly renderer: ISharedTimeseriesRenderer }
  | { readonly status: 'unsupported'; readonly renderer: null };

const INITIALIZING_STATE: TSharedRendererState = { status: 'initializing', renderer: null };
const UNSUPPORTED_STATE: TSharedRendererState = { status: 'unsupported', renderer: null };

const SharedRendererContext = createContext<TSharedRendererState>(INITIALIZING_STATE);

export function useSharedRendererState(): TSharedRendererState {
  return useContext(SharedRendererContext);
}

export const SharedRendererProvider = memo(({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<TSharedRendererState>(INITIALIZING_STATE);

  useEffect(() => {
    let destroyed = false;
    let instance: ISharedTimeseriesRenderer | undefined;

    void createSharedRenderer()
      .then(sharedRenderer => {
        if (destroyed) {
          sharedRenderer.destroy();
          return;
        }
        instance = sharedRenderer;
        setState({ status: 'ready', renderer: sharedRenderer });
      })
      .catch((error: unknown) => {
        // `navigator.gpu` can exist while `requestAdapter()` still resolves to null
        // (software rendering, blocklisted GPUs). Surface the guard notice instead of
        // leaving four permanently blank canvases behind an unhandled rejection.
        // biome-ignore lint/suspicious/noConsole: surfaces WebGPU init failure
        console.warn('timeseries: shared WebGPU renderer init failed', error);
        setState(UNSUPPORTED_STATE);
      });

    return () => {
      destroyed = true;

      if (!isNil(instance)) {
        instance.destroy();
      }
    };
  }, []);

  return <SharedRendererContext value={state}>{children}</SharedRendererContext>;
});
