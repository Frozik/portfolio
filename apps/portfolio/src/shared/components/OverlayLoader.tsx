import { Spinner } from '@frozik/components/ui/Spinner';
import { memo } from 'react';

export const OverlayLoader = memo(() => (
  <div className="flex h-dvh w-dvw items-center justify-center overflow-hidden">
    <Spinner size="lg" />
  </div>
));
