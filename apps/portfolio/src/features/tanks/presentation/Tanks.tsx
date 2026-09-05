import { memo } from 'react';

import { WebGpuGuard } from '../../../shared/components/WebGpuGuard';
import { KeyStateSource } from '../infrastructure/key-state-source';
import { TanksGame } from './components/TanksGame';

/** Composition root: the browser-bound input source is built here and handed to the game. */
function createKeyboardSource(): KeyStateSource {
  return new KeyStateSource();
}

export const Tanks = memo(() => {
  return (
    <WebGpuGuard className="h-full w-full">
      <TanksGame createKeyboardSource={createKeyboardSource} />
    </WebGpuGuard>
  );
});
