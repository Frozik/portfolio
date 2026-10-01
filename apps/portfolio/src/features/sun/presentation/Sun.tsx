import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useEffect, useRef } from 'react';

import { WebGpuUnsupportedNotice } from '../../../shared/components/WebGpuUnsupportedNotice';
import { runSun } from '../application/render/sun-draw';
import { useSunStore } from '../application/useSunStore';
import { BenchmarkPanel } from './components/BenchmarkPanel';

export const Sun = observer(() => {
  const store = useSunStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (isNil(canvas)) {
      return undefined;
    }
    return runSun({ canvas, store });
  }, [store]);

  const { gpu } = store;
  // A lost device is not a browser to set up: the how-to-enable notice would mislead.
  const isUnsupported = gpu.kind === 'unavailable' && gpu.failure.reason !== 'device-lost';

  return (
    <div className="relative h-full w-full">
      <canvas ref={canvasRef} className="h-full w-full [touch-action:none]" />
      {isUnsupported && <WebGpuUnsupportedNotice className="absolute inset-0 overflow-y-auto" />}
      <BenchmarkPanel store={store} />
    </div>
  );
});
