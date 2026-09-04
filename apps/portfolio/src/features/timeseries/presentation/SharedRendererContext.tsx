import { toFail } from '@frozik/utils/value-descriptors/fails/utils';
import type { ValueDescriptorFail } from '@frozik/utils/value-descriptors/types';
import { isNil } from 'lodash-es';
import type { ReactNode } from 'react';
import { createContext, memo, useContext, useEffect, useState } from 'react';

import { createSharedRenderer } from '../application/render/shared-renderer';
import type { ISharedTimeseriesRenderer } from '../application/render/types';

/** `unsupported` carries the failure: `navigator.gpu` may exist while the adapter request still fails. */
export type TSharedRendererState =
  | { readonly status: 'initializing' }
  | { readonly status: 'ready'; readonly renderer: ISharedTimeseriesRenderer }
  | { readonly status: 'unsupported'; readonly fail: ValueDescriptorFail };

const INITIALIZING_STATE: TSharedRendererState = { status: 'initializing' };

const SharedRendererContext = createContext<TSharedRendererState>(INITIALIZING_STATE);

export function useSharedRendererState(): TSharedRendererState {
  return useContext(SharedRendererContext);
}

export const SharedRendererProvider = memo(({ children }: { readonly children: ReactNode }) => {
  const [state, setState] = useState<TSharedRendererState>(INITIALIZING_STATE);

  useEffect(() => {
    let destroyed = false;
    let instance: ISharedTimeseriesRenderer | undefined;

    void createSharedRenderer().then(
      sharedRenderer => {
        if (destroyed) {
          sharedRenderer.destroy();
          return;
        }
        instance = sharedRenderer;
        setState({ status: 'ready', renderer: sharedRenderer });
      },
      (error: unknown) => {
        setState({ status: 'unsupported', fail: toFail(error) });
      }
    );

    return () => {
      destroyed = true;
      if (!isNil(instance)) {
        instance.destroy();
      }
    };
  }, []);

  return <SharedRendererContext value={state}>{children}</SharedRendererContext>;
});
