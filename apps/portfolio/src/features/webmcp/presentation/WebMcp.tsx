import { isNil } from 'lodash-es';
import { ArrowUpRight } from 'lucide-react';
import { memo } from 'react';
import { Link } from 'react-router-dom';

import { CardFrame } from '../../../shared/ui/CardFrame';
import { MonoKicker } from '../../../shared/ui/MonoKicker';
import { SectionNumber } from '../../../shared/ui/SectionNumber';
import type { IToolSection } from './tool-catalog';
import { TOOL_CATALOG } from './tool-catalog';
import { webMcpT } from './translations';

const WEBMCP_DOCS_URL = 'https://developer.chrome.com/docs/ai/webmcp';
const GEMINI_AUTO_BROWSE_URL = 'https://support.google.com/chrome/answer/16821166';
const ICON_SIZE_PX = 14;

const linkClassName =
  'inline-flex items-center gap-1 font-mono text-[12px] uppercase tracking-[0.1em] text-landing-accent hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-landing-accent';

export const WebMcp = memo(() => (
  <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
    <div className="mx-auto flex w-full max-w-[var(--container-narrow)] flex-col gap-12 px-6 pt-12 pb-20 sm:px-8">
      <section className="flex flex-col gap-6">
        <SectionNumber number="01" label={webMcpT.hero.sectionKicker} />
        <h1 className="text-[clamp(40px,8vw,64px)] font-medium leading-[1.02] tracking-[-0.03em] text-landing-fg">
          {webMcpT.hero.headlinePrimary}
          <br />
          <span className="font-serif text-landing-fg-faint italic">
            {webMcpT.hero.headlineAccent}
          </span>
        </h1>
        <p className="max-w-[640px] text-[15px] leading-[1.55] text-landing-fg-dim">
          {webMcpT.hero.subtitle}
        </p>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <ExternalLink href={GEMINI_AUTO_BROWSE_URL}>{webMcpT.hero.userGuideLink}</ExternalLink>
          <ExternalLink href={WEBMCP_DOCS_URL}>{webMcpT.hero.docsLink}</ExternalLink>
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <SectionNumber number="02" label={webMcpT.catalog.sectionKicker} />
        <h2 className="text-[24px] font-medium text-landing-fg">{webMcpT.catalog.title}</h2>
        {TOOL_CATALOG.map(section => (
          <ToolSection key={section.id} section={section} />
        ))}
      </section>
    </div>
  </div>
));

const ExternalLink = memo(
  ({ href, children }: { readonly href: string; readonly children: string }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className={linkClassName}>
      {children}
      <ArrowUpRight size={ICON_SIZE_PX} aria-hidden="true" />
    </a>
  )
);

const ToolSection = memo(({ section }: { readonly section: IToolSection }) => {
  const { title, summary } = webMcpT.catalog.sections[section.id];

  return (
    <CardFrame className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 className="text-[18px] font-medium text-landing-fg">{title}</h3>
        {!isNil(section.route) && (
          <Link to={section.route} className={linkClassName}>
            {webMcpT.catalog.openDemo}
          </Link>
        )}
      </div>
      <p className="text-[14px] leading-[1.55] text-landing-fg-dim">{summary}</p>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
        {section.tools.map(tool => (
          <div key={tool} className="contents">
            <dt>
              <MonoKicker tone="accent" className="normal-case tracking-normal text-[12px]">
                {tool}
              </MonoKicker>
            </dt>
            <dd className="text-[13px] leading-[1.5] text-landing-fg-dim">
              {webMcpT.catalog.tools[tool]}
            </dd>
          </div>
        ))}
      </dl>
    </CardFrame>
  );
});
