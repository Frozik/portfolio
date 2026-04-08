import { memo } from 'react';
import { cn } from '../../../../shared/lib/cn';

import styles from '../styles.module.scss';
import { getYearsOfExperience } from '../utils';
import { SMALLEST_START_DATE } from './WorkExperience';

export const Summary = memo(() => (
  <>
    <h2 className={styles.cardTitle}>Professional summary</h2>
    <section className={cn(styles.card, styles.cardWithTitle)}>
      <p>
        Senior Frontend Engineer and Team Leader with {getYearsOfExperience(SMALLEST_START_DATE)}+
        years of experience building high-performance web applications. Specialized in WebGPU/WebGL
        data visualization, real-time trading systems, and scalable frontend architecture. Led a
        frontend team of 7 engineers at Yandex.Money — owned product architecture end-to-end
        (full-stack), established code review culture, mentored developers, and drove key
        architectural decisions. Delivered enterprise products at Deutsche Bank. Experienced in
        Agile/Scrum environments with cross-functional collaboration.
      </p>
    </section>
  </>
));
