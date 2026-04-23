import { Fragment, memo } from 'react';

import { cn } from '../../../../../shared/lib/cn';

const ACCENT_MARKER = /\*([^*]+)\*/g;

type SectionHeadProps = {
  readonly number: string;
  readonly kicker: string;
  readonly title: string;
  readonly className?: string;
};

function renderTitleWithAccents(title: string): readonly React.ReactNode[] {
  const chunks: React.ReactNode[] = [];
  let cursor = 0;
  let keyIndex = 0;
  for (const match of title.matchAll(ACCENT_MARKER)) {
    const matchStart = match.index ?? 0;
    if (matchStart > cursor) {
      chunks.push(<Fragment key={keyIndex++}>{title.slice(cursor, matchStart)}</Fragment>);
    }
    chunks.push(
      <span key={keyIndex++} className="text-landing-accent">
        {match[1]}
      </span>
    );
    cursor = matchStart + match[0].length;
  }
  if (cursor < title.length) {
    chunks.push(<Fragment key={keyIndex++}>{title.slice(cursor)}</Fragment>);
  }
  return chunks;
}

const SectionHeadComponent = ({ number, kicker, title, className }: SectionHeadProps) => (
  <header
    className={cn('mb-8 md:mb-12 print:mb-2 print:md:mb-2', 'print:break-before-page', className)}
  >
    {/* Kicker row (number / kicker / rule) is decorative — never on paper. */}
    <div className="mb-4 flex items-center gap-4 md:mb-6 print:hidden">
      <span className="font-mono text-[11px] uppercase tracking-widest text-landing-accent">
        {number}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-widest text-landing-fg-faint">
        {kicker}
      </span>
      <span className="section-rule" />
    </div>
    <h2 className="text-[clamp(28px,5vw,48px)] font-medium leading-[1.1] tracking-[-0.02em] text-landing-fg print:text-[24px]">
      {renderTitleWithAccents(title)}
    </h2>
  </header>
);

export const SectionHead = memo(SectionHeadComponent);
