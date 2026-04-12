import { memo } from 'react';

import { getYearsOfExperience } from '../../utils';
import { SMALLEST_START_DATE } from './WorkExperience';

export const Summary = memo(() => (
  <>
    <h2 className="mx-5 mb-1 shrink-0 text-white print:text-black">Professional summary</h2>
    <section className="mx-5 mb-5 flex shrink-0 flex-col gap-3 border-t border-[#434343] pt-0.5 print:border-t-[#ccc]">
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
