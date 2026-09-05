import { memo } from 'react';
import { Spinner } from '../ui/Spinner';

export const OverlayLoader = memo(() => (
  <div className="flex h-dvh w-dvw items-center justify-center overflow-hidden">
    <Spinner size="lg" />
  </div>
));
