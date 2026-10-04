import { cn } from '@frozik/components/components/cn';
import { isNil } from 'lodash-es';
import { Bot } from 'lucide-react';
import { memo } from 'react';
import { Link } from 'react-router-dom';

import { appT } from '../translations';

const WEBMCP_PAGE = '/webmcp';
const ICON_SIZE_PX = 16;

/**
 * Marks a demo that exposes WebMCP tools and links to the page that lists them. It lights up
 * with a live dot when this browser actually registered them; elsewhere it stays
 * dim and its title explains how to turn WebMCP on.
 */
export const WebMcpBadge = memo(({ toolCount }: { readonly toolCount: number | undefined }) => {
  const isLive = !isNil(toolCount);
  const title = isNil(toolCount) ? appT.nav.webMcpAvailable : appT.nav.webMcpLive(toolCount);

  return (
    <Link
      to={WEBMCP_PAGE}
      title={title}
      aria-label={title}
      className={cn(
        'flex h-9 items-center gap-1.5 rounded-sm border px-2.5',
        'font-mono text-[11px] uppercase tracking-[0.1em] transition-colors',
        'hover:border-landing-accent hover:bg-landing-accent/10 hover:text-landing-accent',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-landing-accent',
        isLive
          ? 'border-landing-accent/60 text-landing-accent'
          : 'border-landing-border text-landing-fg-dim'
      )}
    >
      <Bot size={ICON_SIZE_PX} aria-hidden="true" />
      <span className="hidden sm:inline">{appT.nav.webMcpLabel}</span>
      {isLive && (
        <span
          className="size-1.5 animate-pulse rounded-full bg-landing-accent"
          aria-hidden="true"
        />
      )}
    </Link>
  );
});
