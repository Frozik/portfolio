import { Temporal } from '@js-temporal/polyfill';
import { isEmpty, isNil } from 'lodash-es';
import { ExternalLink } from 'lucide-react';
import { memo } from 'react';

import { formatDateMonthYear, measureDuration } from '../../utils';
import { welcomeT } from '../translations';

const employmentHistory = [...welcomeT.employmentHistory];

export const SMALLEST_START_DATE = employmentHistory.reduce(
  (acc, { start }) => (Temporal.PlainDate.compare(acc, start) < 0 ? acc : start),
  employmentHistory[0].start
);

export const WorkExperience = memo(() => {
  return (
    <>
      <h2 className="mx-5 mb-1 shrink-0 text-white print:text-black">
        {welcomeT.workExperience.title(measureDuration(SMALLEST_START_DATE))}
      </h2>
      <section className="mx-5 mb-5 flex shrink-0 flex-col gap-3 border-t border-[#434343] pt-0.5 [&_h1]:m-0 [&_h1]:text-white [&_h2]:m-0 [&_h2]:text-white [&_h3]:m-0 [&_h3]:text-white [&_h4]:m-0 [&_h4]:text-white [&_h5]:m-0 [&_h5]:text-white [&_h6]:m-0 [&_h6]:text-white [&_ul]:pl-0 [&_li]:list-none print:border-t-[#ccc] print:[&_h1]:text-black print:[&_h2]:text-black print:[&_h3]:text-black print:[&_h4]:text-black print:[&_h5]:text-black print:[&_h6]:text-black">
        {employmentHistory.map(work => (
          <article className="flex flex-1 flex-col" key={work.company}>
            <div className="flex shrink-0 flex-row gap-3 bg-black px-2.5 py-1 print:bg-[#f5f5f5]">
              <div className="flex-1 [&_a]:text-white [&_a]:no-underline print:[&_a]:text-black">
                <h2>
                  {isEmpty(work.website) ? (
                    work.company
                  ) : (
                    <a href={work.website} target="_blank" rel="noreferrer">
                      {work.company} <ExternalLink size={14} className="inline" />
                    </a>
                  )}
                </h2>
                <h5>{work.location}</h5>
                <h4 className="text-[#8c8c8c] [&_ul]:m-0 [&_ul]:pl-5 [&_li]:list-disc">
                  {work.scopeOfActivity}
                </h4>
              </div>
              <div className="shrink-0 [&_p]:m-0">
                <p>
                  {formatDateMonthYear(work.start)} -{' '}
                  {isNil(work.end)
                    ? welcomeT.workExperience.tillNow
                    : formatDateMonthYear(work.end)}
                </p>
                <h5>{measureDuration(work.start, work.end)}</h5>
              </div>
            </div>

            <div className="border-l-4 border-l-[#003eb3] px-2.5 py-2 [&_a]:text-[#1677ff] [&_ul]:mb-3 [&_ul]:pl-5 [&_li]:list-disc [&_ul_ul]:pl-5 [&_ul_ul_li]:list-[circle] print:border-l-[#999] print:[&_a]:text-[#333]">
              <h3>{work.position}</h3>

              {work.description}
            </div>
          </article>
        ))}
      </section>
    </>
  );
});
