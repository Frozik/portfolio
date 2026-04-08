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
          <Tag color="magenta">TypeScript</Tag>
          <Tag color="magenta">JavaScript</Tag>

          <Tag color="green">React</Tag>
          <Tag color="green">Next.js</Tag>
          <Tag color="green">React Router</Tag>
          <Tag color="green">MobX</Tag>
          <Tag color="green">Zustand</Tag>
          <Tag color="green">Redux Toolkit</Tag>
          <Tag color="green">RxJS</Tag>
          <Tag color="green">Tailwind CSS</Tag>
          <Tag color="green">Radix UI</Tag>
          <Tag color="green">Storybook</Tag>

          <Tag color="gold">WebGPU</Tag>
          <Tag color="gold">WebGL</Tag>
          <Tag color="gold">TensorFlow.js</Tag>
          <Tag color="gold">Matter.js</Tag>

          <Tag color="cyan">Vitest</Tag>
          <Tag color="cyan">Jest</Tag>
          <Tag color="cyan">Playwright</Tag>
          <Tag color="cyan">Cypress</Tag>

          <Tag color="geekblue">Vite</Tag>
          <Tag color="geekblue">webpack</Tag>
          <Tag color="geekblue">NX</Tag>
          <Tag color="geekblue">Moon</Tag>
          <Tag color="geekblue">Biome</Tag>
          <Tag color="geekblue">Docker</Tag>
          <Tag color="geekblue">GitHub Actions</Tag>

          <Tag color="purple">Micro-frontends</Tag>
          <Tag color="purple">Design Systems</Tag>
          <Tag color="purple">Monorepo</Tag>
          <Tag color="purple">Message Queues</Tag>

          <Tag color="orange">Node.js</Tag>
          <Tag color="orange">PostgreSQL</Tag>
          <Tag color="orange">Redis</Tag>
          <Tag color="orange">GraphQL</Tag>
          <Tag color="orange">REST API</Tag>
          <Tag color="orange">WebSocket</Tag>
          <Tag color="orange">OAuth 2.0</Tag>
          <Tag color="orange">JWT</Tag>

          <Tag color="red">Team Leadership</Tag>
          <Tag color="red">Code Review</Tag>
          <Tag color="red">Mentoring</Tag>
          <Tag color="red">Architecture Ownership</Tag>
          <Tag color="red">Agile / Scrum</Tag>
          <Tag color="red">Cross-functional Collaboration</Tag>
          <Tag color="red">Production Incident Response</Tag>
        </div>
      </div>
    </section>
  </>
));
