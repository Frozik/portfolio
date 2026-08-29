import { isNil } from 'lodash-es';
import type { ReactNode } from 'react';
import { memo } from 'react';

import { WebGpuUnsupportedNotice } from './WebGpuUnsupportedNotice';

export const WebGpuGuard = memo(
  ({ children, className }: { children: ReactNode; className?: string }) => {
    if (isNil(navigator.gpu)) {
      return <WebGpuUnsupportedNotice className={className} />;
    }

    return children;
  }
);
