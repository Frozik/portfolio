import { memo } from 'react';
import { cn } from '../../../../shared/lib/cn';

import styles from '../styles.module.scss';

export const Position = memo(() => (
  <>
    <h2 className={styles.cardTitle}>Desired position and salary</h2>
    <section className={cn(styles.card, styles.cardWithTitle, styles.cardWithRowMode)}>
      <div className={styles.flexStretch}>
        <h3>Senior Frontend Engineer, Team Leader</h3>
        <ul>
          <li>Specializations: Team Leader, Developer</li>
          <li>Employment: full time</li>
          <li>Work schedule: full day</li>
          <li>Desired travel time to work: less than hour</li>
        </ul>
      </div>
    </section>
  </>
));
