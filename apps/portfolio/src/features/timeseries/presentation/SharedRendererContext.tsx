import { isNil } from 'lodash-es';
import { createContext, memo, useContext, useEffect, useState } from 'react';
import { createSharedRenderer } from '../domain/shared-renderer';
import type { ISharedTimeseriesRenderer } from '../domain/types';

const SharedRendererContext = createContext<ISharedTimeseriesRenderer | null>(null);

export function useSharedRenderer(): ISharedTimeseriesRenderer | null {
  return useContext(SharedRendererContext);
}

export const SharedRendererProvider = memo(({ children }: { children: React.ReactNode }) => {
  const [renderer, setRenderer] = useState<ISharedTimeseriesRenderer | null>(null);

  useEffect(() => {
    let destroyed = false;
    let instance: ISharedTimeseriesRenderer | undefined;

    void createSharedRenderer().then(r => {
      if (destroyed) {
        r.destroy();
        return;
      }
      instance = r;
      setRenderer(r);
    });

    return () => {
      destroyed = true;

      if (!isNil(instance)) {
        instance.destroy();
      }
    };
  }, []);

  return <SharedRendererContext value={renderer}>{children}</SharedRendererContext>;
});
