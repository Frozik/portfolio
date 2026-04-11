import { memo } from 'react';

export const Position = memo(() => (
  <>
    <h2 className="mx-5 mb-1 shrink-0 text-white print:text-black">Desired position</h2>
    <section className="mx-5 mb-5 flex shrink-0 flex-row gap-3 border-t border-[#434343] pt-0.5 [&_h1]:m-0 [&_h1]:text-white [&_h2]:m-0 [&_h2]:text-white [&_h3]:m-0 [&_h3]:text-white [&_ul]:pl-0 [&_li]:list-none print:border-t-[#ccc] print:[&_h1]:text-black print:[&_h2]:text-black print:[&_h3]:text-black">
      <div className="flex-1">
        <h3>Senior Frontend Engineer, Team Leader</h3>
        <ul>
          <li>Specializations: Team Leader, Developer</li>
          <li>Employment: full time</li>
        </ul>
      </div>
    </section>
  </>
));
