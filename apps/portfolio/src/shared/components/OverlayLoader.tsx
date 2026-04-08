import { memo } from 'react';
import { Spinner } from '../ui';
import styles from './styles.module.scss';

export const OverlayLoader = memo(() => (
  <div className={styles.container}>
    <Spinner size="lg" />
  </div>
));
