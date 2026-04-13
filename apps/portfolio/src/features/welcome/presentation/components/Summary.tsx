import { memo } from 'react';

import { getYearsOfExperience } from '../../utils';
import { welcomeT } from '../translations';
import { SMALLEST_START_DATE } from './WorkExperience';

export const Summary = memo(() => (
  <>
    <h2 className="mx-5 mb-1 shrink-0 text-white print:text-black">{welcomeT.summary.title}</h2>
    <section className="mx-5 mb-5 flex shrink-0 flex-col gap-3 border-t border-[#434343] pt-0.5 print:border-t-[#ccc]">
      <p>{welcomeT.summary.text(getYearsOfExperience(SMALLEST_START_DATE))}</p>
    </section>
  </>
));
