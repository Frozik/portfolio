import { isNil } from 'lodash-es';
import type { RefObject } from 'react';
import { useEffect, useRef } from 'react';

/**
 * Mounts a WebGPU app on a canvas: `run` starts it once the canvas exists and
 * its returned teardown stops it on unmount. `run` must be referentially
 * stable — a module-level function — because a new one restarts the app.
 */
export function useGpuCanvas(
  run: (canvas: HTMLCanvasElement) => VoidFunction
): RefObject<HTMLCanvasElement | null> {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (isNil(canvas)) {
      return undefined;
    }
    return run(canvas);
  }, [run]);

  return canvasRef;
}
