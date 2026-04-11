import { useHasOverflow } from '@frozik/components';
import { memo, useRef } from 'react';
import avatarUrl from '../../../assets/avatar.png';
import { cn } from '../../../shared/lib/cn';
import { Avatar } from '../../../shared/ui';
import { Contacts } from './components/Contacts';
import { Education } from './components/Education';
import { IdeaLightbulb } from './components/IdeaLightbulb';
import { Position } from './components/Position';
import { Skills } from './components/Skills';
import { SleepingZzz } from './components/SleepingZzz';
import { Summary } from './components/Summary';
import { WorkExperience } from './components/WorkExperience';
import { useIsAwake } from './hooks/useIsAwake';

export const Welcome = memo(() => {
  const isAwake = useIsAwake();
  const cvRef = useRef<HTMLDivElement>(null);

  const { canScrollTop, canScrollBottom } = useHasOverflow(cvRef);

  return (
    <div className="flex h-dvh w-dvw flex-col items-stretch overflow-hidden p-5 max-[840px]:p-0 print:h-auto print:w-auto print:overflow-visible print:p-0">
      <section
        ref={cvRef}
        className={cn(
          'mx-auto flex h-full max-w-[1000px] flex-col items-stretch overflow-y-scroll border border-[#434343] bg-[#141414] text-sm leading-[1.5714] text-[#8c8c8c] rounded-[10px] scrollbar-none max-[840px]:rounded-none print:max-w-none print:h-auto print:overflow-y-visible print:border-none print:rounded-none print:bg-white print:text-[#333]',
          canScrollTop && 'border-t-[6px] border-t-[#001d66] print:border-t-0',
          canScrollBottom && 'border-b-[6px] border-b-[#001d66] print:border-b-0'
        )}
      >
        <div className="mx-5 mb-5 mt-5 flex shrink-0 flex-row gap-3 max-[500px]:flex-col max-[500px]:items-center max-[500px]:p-0">
          <div className="relative h-50 w-50 shrink-0">
            <Avatar className="h-50 w-50" src={avatarUrl} />
            {isAwake ? <IdeaLightbulb /> : <SleepingZzz />}
          </div>
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
