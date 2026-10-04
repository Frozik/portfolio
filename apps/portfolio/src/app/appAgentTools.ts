import { z } from 'zod';

import type { IAgentTool } from '@frozik/utils/webmcp/agentTool';
import { defineAgentTool } from '@frozik/utils/webmcp/agentTool';
import { ROUTE_METADATA } from './routeMetadata';
import { appT } from './translations';

const DEMOS = ROUTE_METADATA.filter(route => route.navVisible);
const DEMO_SEGMENTS = DEMOS.map(route => route.segment);

function currentDemo(pathname: string): string | undefined {
  const firstSegment = pathname.split('/')[1] ?? '';
  return DEMO_SEGMENTS.find(segment => segment === firstSegment);
}

export function createAppAgentTools({
  openPath,
  currentPathname,
}: {
  readonly openPath: (path: string) => void;
  readonly currentPathname: () => string;
}): readonly IAgentTool[] {
  return [
    defineAgentTool({
      name: 'portfolio_list_demos',
      title: 'List the demos',
      description:
        'Lists the interactive demos of this portfolio and which one is open. An open demo ' +
        'may register tools of its own; they disappear when the user leaves it.',
      input: z.object({}),
      readOnly: true,
      execute: () => ({
        demos: DEMOS.map(route => ({
          demo: route.segment,
          title: appT.pageTitles[route.titleKey],
        })),
        current: currentDemo(currentPathname()) ?? null,
      }),
    }),
    defineAgentTool({
      name: 'portfolio_open_demo',
      title: 'Open a demo',
      description:
        'Navigates the page to a demo. Call portfolio_list_demos to see what each one is.',
      input: z.object({ demo: z.enum(DEMO_SEGMENTS) }),
      execute: ({ demo }) => {
        openPath(`/${demo}`);
        return { opened: demo };
      },
    }),
  ];
}
