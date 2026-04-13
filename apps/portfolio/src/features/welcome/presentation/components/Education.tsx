import { memo } from 'react';

import { welcomeT } from '../translations';

export const Education = memo(() => (
  <>
    <h2 className="mx-5 mb-1 shrink-0 text-white print:text-black">{welcomeT.education.title}</h2>
    <section className="mx-5 mb-5 flex shrink-0 flex-row gap-3 border-t border-[#434343] pt-0.5 [&_h3]:m-0 [&_h3]:text-white [&_h4]:m-0 [&_h4]:text-white print:border-t-[#ccc] print:[&_h3]:text-black print:[&_h4]:text-black">
      <div className="flex-1">
        <h3>{welcomeT.education.university}</h3>
        <h4>
          {welcomeT.education.degree}
          <br />
          {welcomeT.education.faculty}
        </h4>
      </div>
      <div className="shrink-0">
        <h3>2005</h3>
      </div>
    </section>
  </>
));
