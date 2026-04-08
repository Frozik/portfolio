import { memo } from 'react';
import { cn } from '../../../../shared/lib/cn';

import styles from '../styles.module.scss';

export const Education = memo(() => (
  <>
    <h2 className={styles.cardTitle}>Education</h2>
    <section className={cn(styles.card, styles.cardWithTitle, styles.cardWithRowMode)}>
      <div className={styles.flexStretch}>
        <h3>Novgorod Yaroslav the Wise State University, Veliky Novgorod</h3>
        <h4>
          Faculty of Electronics and Information Technology, Computers and Automated Systems
          Software
        </h4>
      </div>
      <div className={styles.flexFixed}>
        <h3>2005</h3>
      </div>
    </section>
  </>
));
