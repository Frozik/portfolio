import { memo } from 'react';

import { welcomeT } from '../translations';

/**
 * Anchor navigation rendered inside the {@link TopNav} center slot on
 * the landing page. Hidden below `min-[990px]` (mobile users get the
 * burger menu); on wide screens it lists every welcome section with
 * its ordinal label, scrolling to the matching `#section-id` on click.
 */
export const LandingTopNavSections = memo(() => {
  return (
    <div className="hidden font-mono text-xs text-landing-fg-dim min-[990px]:flex min-[990px]:gap-8">
      {welcomeT.nav.sections.map(section => (
        <a
          key={section.id}
          href={`#${section.id}`}
          className="transition-colors hover:text-landing-fg"
        >
          <span className="mr-1.5 text-landing-fg-faint">{section.number}</span>
          {section.label}
        </a>
      ))}
    </div>
  );
});
