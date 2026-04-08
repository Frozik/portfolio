import { memo } from 'react';
import { cn } from '../../../shared/lib/cn';

import commonStyles from '../../styles.module.scss';
import { DatePage } from './components/DatePage';
import { NumberPage } from './components/NumberPage';
import styles from './styles.module.scss';

export const Controls = memo(() => {
  return (
    <div className={cn(styles.container, commonStyles.fixedContainer)}>
      <NumberPage />
      <DatePage />
    </div>
  );
});
