import { useFunction } from '@frozik/components/hooks/useFunction';
import { isNil } from 'lodash-es';
import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';

import type { SiteSceneSession } from '../../application/render/run-site-scene';
import { runSiteScene } from '../../application/render/run-site-scene';
import type { SitePlannerStore } from '../../application/SitePlannerStore';

/**
 * Ties the 3D session to the mounted canvas and hands back the camera reset.
 * Strict-mode's mount → cleanup → mount cycle disposes the session and builds a
 * new one, device included; the store outlives both, so the plan is untouched.
 */
export function useSceneSession(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  store: SitePlannerStore
): VoidFunction {
  const sessionRef = useRef<SiteSceneSession | undefined>(undefined);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (isNil(canvas)) {
      return undefined;
    }

    const session = runSiteScene({ canvas, store });

    sessionRef.current = session;

    return () => {
      sessionRef.current = undefined;
      session.dispose();
    };
  }, [canvasRef, store]);

  return useFunction(() => sessionRef.current?.resetCamera());
}
