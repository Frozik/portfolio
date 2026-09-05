import type { AnyFail } from '@frozik/utils/value-descriptors/fails/types';
import { memo } from 'react';
import { Alert } from '../ui/Alert';

export const ValueDescriptorFail = memo(
  ({ className, fail }: { className?: string; fail: AnyFail }) => (
    <div className="flex h-dvh w-dvw items-center justify-center overflow-hidden">
      <Alert
        className={className}
        message={fail.meta.message}
        description={fail.meta.description}
        type="error"
      />
    </div>
  )
);
