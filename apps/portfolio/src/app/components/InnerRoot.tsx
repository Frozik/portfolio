import { memo } from 'react';

import { TooltipProvider } from '../../shared/ui/Tooltip';
import { StoreBootstrap } from '../stores/StoreBootstrap';
import { InnerLayout } from './InnerLayout';

/**
 * Root of every inner demo route: the MobX store registry, the tooltip
 * provider and the inner-page shell. Loaded lazily from `Application.tsx`, so
 * none of it is on the landing page's critical path.
 */
const InnerRootComponent = () => (
  <StoreBootstrap>
    <TooltipProvider>
      <InnerLayout />
    </TooltipProvider>
  </StoreBootstrap>
);

export const InnerRoot = memo(InnerRootComponent);
