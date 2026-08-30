import { Home } from 'lucide-react';
import { memo, useRef } from 'react';

import { WebGpuGuard } from '../../../../shared/components/WebGpuGuard';
import { Tooltip } from '../../../../shared/ui/Tooltip';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import { useSceneSession } from '../hooks/useSceneSession';
import { sitePlannerT } from '../translations';
import { AnalysisPanel } from './AnalysisPanel';
import { SceneCompass } from './SceneCompass';
import { SunStudyPanel } from './SunStudyPanel';

const ICON_SIZE_PX = 16;

/**
 * Host of the 3D view. Everything on the canvas comes from the render session,
 * so the component reads no observables and never re-renders on plan edits; the
 * only React over it is the button that puts the camera back.
 */
export const SceneCanvas = memo(({ store }: { readonly store: SitePlannerStore }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resetCamera = useSceneSession(canvasRef, store);

  return (
    <WebGpuGuard className="min-h-0 w-full flex-1">
      <div className="relative min-h-0 w-full flex-1">
        <canvas
          ref={canvasRef}
          aria-label={sitePlannerT.scene.canvasLabel}
          className="absolute inset-0 block size-full touch-none rounded-2xl border border-white/10"
        />
        <Tooltip title={sitePlannerT.scene.resetCamera} placement="left">
          <button
            type="button"
            aria-label={sitePlannerT.scene.resetCamera}
            onClick={resetCamera}
            className="absolute right-3 bottom-3 flex size-9 items-center justify-center rounded-lg border border-white/10 bg-black/50 text-text-secondary transition-colors duration-150 hover:bg-white/10 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <Home size={ICON_SIZE_PX} aria-hidden />
          </button>
        </Tooltip>
        <SceneCompass store={store} />
        <AnalysisPanel store={store} />
        <SunStudyPanel store={store} />
      </div>
    </WebGpuGuard>
  );
});
