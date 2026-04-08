import { memo } from 'react';
import { cn } from '../../../../shared/lib/cn';
import { Tag } from '../../../../shared/ui';

import styles from '../styles.module.scss';

export const Skills = memo(() => (
  <>
    <h2 className={styles.cardTitle}>Key skills</h2>
    <section className={cn(styles.card, styles.cardWithTitle, styles.cardWithRowMode)}>
      <div className={styles.flexStretch}>
        <div className={cn(styles.skillsBlock, 'flex flex-wrap gap-1')}>
          <Tag color="magenta">JavaScript</Tag>
          <Tag color="magenta">TypeScript</Tag>
          <Tag color="magenta">CSS</Tag>
          <Tag color="magenta">SCSS</Tag>
          <Tag color="magenta">HTML</Tag>

          <Tag color="gold">NX</Tag>
          <Tag color="gold">Lerna</Tag>
          <Tag color="gold">Rush</Tag>

          <Tag color="lime">npm</Tag>
          <Tag color="lime">pnpm</Tag>
          <Tag color="lime">yarn</Tag>

          <Tag color="green">React</Tag>
          <Tag color="green">React Router</Tag>
          <Tag color="green">Redux</Tag>
          <Tag color="green">Redux Saga</Tag>
          <Tag color="green">Redux Toolkit</Tag>
          <Tag color="green">RxJs</Tag>
          <Tag color="green">TensorFlow JS</Tag>
          <Tag color="green">WebGL</Tag>

          <Tag color="cyan">Git</Tag>

          <Tag color="geekblue">Vite</Tag>
          <Tag color="geekblue">ESBuild</Tag>
          <Tag color="geekblue">webpack</Tag>

          <Tag color="purple">OAuth 2.0</Tag>
          <Tag color="purple">JWT</Tag>
          <Tag color="purple">WebSSO</Tag>

          <Tag color="orange">node.js</Tag>
        </div>
      </div>
    </section>
  </>
));
