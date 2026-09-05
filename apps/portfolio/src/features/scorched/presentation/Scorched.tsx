import { memo } from 'react';

import { WebGpuGuard } from '../../../shared/components/WebGpuGuard';
import { KeyAimSource } from '../infrastructure/key-aim-source';
import { ScorchedGame } from './components/ScorchedGame';

/** Composition root: the browser-bound input source is built here and handed to the game. */
function createKeyAimSource(): KeyAimSource {
  return new KeyAimSource();
}

export const Scorched = memo(() => {
  return (
    <WebGpuGuard className="h-full w-full">
      <ScorchedGame createKeyAimSource={createKeyAimSource} />
    </WebGpuGuard>
  );
});
