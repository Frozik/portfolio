import { memo } from 'react';

import { formatDateMonthYear, measureDuration } from '../../../utils';
import type { IExperienceTranslation } from '../../translations';
import { welcomeT } from '../../translations';

type ExperienceItemProps = {
  readonly entry: IExperienceTranslation;
};

const ExperienceItemComponent = ({ entry }: ExperienceItemProps) => {
  const startLabel = formatDateMonthYear(entry.start);
  const endLabel = entry.end ? formatDateMonthYear(entry.end) : welcomeT.experience.tillNow;
  const duration = measureDuration(entry.start, entry.end);

  return (
    <article className="exp-item grid grid-cols-1 gap-5 border-t border-landing-border-soft px-3 py-7 md:grid-cols-[180px_1fr] md:gap-10 md:px-5 md:py-9 print:break-inside-avoid print:gap-3 print:px-0 print:py-3 print:md:gap-6 print:md:px-0 print:md:py-3">
      <div>
        <div className="mb-1.5 font-mono text-[11px] text-landing-accent md:text-xs">
          {startLabel} — {endLabel}
        </div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-landing-fg-faint md:text-[11px]">
          {duration}
        </div>
        {entry.location && (
          <div className="mt-1.5 font-mono text-[10px] uppercase tracking-wider text-landing-fg-faint md:text-[11px]">
            {entry.location}
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-1 text-[19px] font-medium tracking-tight md:text-[22px]">
          {entry.website ? (
            <a
              href={entry.website}
              target="_blank"
              rel="noreferrer"
              className="transition-colors hover:text-landing-accent"
            >
              {entry.company}
            </a>
          ) : (
            entry.company
          )}
        </h3>
        <div className="mb-[14px] text-sm text-landing-fg-dim md:text-base">{entry.role}</div>
        {entry.scopeOfActivity && (
          <div className="mb-[14px] text-[13px] italic text-landing-fg-faint md:text-[13.5px]">
            {entry.scopeOfActivity}
          </div>
        )}

        <div className="exp-description mt-4 text-[14.5px] font-light leading-[1.6] text-landing-fg-dim md:text-[15.5px]">
          {entry.description}
        </div>
      </div>
    </article>
  );
};

export const ExperienceItem = memo(ExperienceItemComponent);
