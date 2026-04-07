import { DateEditor } from '@frozik/components';
import { memo } from 'react';

import styles from './styles.module.scss';

export const DatePage = memo(() => {
  return (
    <div className={styles.page}>
      <h3>DatePicker Control</h3>
      <DateEditor placeholder="Enter conversion rate" />
      <div className={styles.controls} />
    </div>
  );
});
