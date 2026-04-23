import { memo } from 'react';

type SkillGroupProps = {
  readonly group: string;
  readonly items: readonly string[];
};

const SkillGroupComponent = ({ group, items }: SkillGroupProps) => (
  <div className="print:flex print:items-baseline print:gap-2 print:break-inside-avoid print:py-0.5">
    <div className="mb-4 font-mono text-[11px] uppercase tracking-wider text-landing-accent md:text-xs print:mb-0 print:shrink-0">
      {group}
    </div>
    <ul className="flex flex-col print:flex-row print:flex-wrap print:gap-x-1.5">
      {items.map((item, index) => (
        <li
          key={item}
          className="row-divider py-2.5 text-[14px] text-landing-fg md:text-[15px] print:py-0 print:text-[12px] print:[border-bottom:none]"
        >
          {item}
          <span aria-hidden="true" className="hidden print:inline">
            {index === items.length - 1 ? '' : ' ·'}
          </span>
        </li>
      ))}
    </ul>
  </div>
);

export const SkillGroup = memo(SkillGroupComponent);
