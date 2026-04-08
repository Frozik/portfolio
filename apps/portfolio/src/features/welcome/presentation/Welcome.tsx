import { useHasOverflow } from '@frozik/components';
import { memo, useRef } from 'react';
import avatarUrl from '../../../assets/avatar.png';
import { cn } from '../../../shared/lib/cn';
import { Avatar } from '../../../shared/ui';
import commonStyles from '../../styles.module.scss';
import { Contacts } from './components/Contacts';
import { Education } from './components/Education';
import { Position } from './components/Position';
import { Skills } from './components/Skills';
import { Summary } from './components/Summary';
import { WorkExperience } from './components/WorkExperience';
import styles from './styles.module.scss';

export const Welcome = memo(() => {
  const cvRef = useRef<HTMLDivElement>(null);

  const { canScrollTop, canScrollBottom } = useHasOverflow(cvRef);

  return (
    <div className={cn(styles.container, commonStyles.fixedContainer)}>
      <section
        ref={cvRef}
        className={cn(styles.cv, {
          [styles.cvScrollTop]: canScrollTop,
          [styles.cvScrollBottom]: canScrollBottom,
        })}
      >
        <div className={cn(styles.card, styles.cardWithAvatar)}>
          <Avatar className={cn(styles.avatar, 'h-[200px] w-[200px]')} src={avatarUrl} />
          <Contacts />
        </div>

        <Summary />

        <Position />

        <Skills />

        <WorkExperience />

        <Education />
      </section>
    </div>
  );
});
