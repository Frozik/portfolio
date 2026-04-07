import type { AnyFail } from '@frozik/utils';
import { memo } from 'react';
import { Alert } from '../ui';
import styles from './styles.module.scss';

export const ValueDescriptorFail = memo(
  ({ className, fail }: { className?: string; fail: AnyFail }) => (
    <div className={styles.container}>
      <Alert
        className={className}
        message={fail.meta.message}
        description={fail.meta.description}
        type="error"
      />
    </div>
  )
);
