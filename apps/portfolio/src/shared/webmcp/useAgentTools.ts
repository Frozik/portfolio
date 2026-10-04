import { isNil } from 'lodash-es';
import { useEffect, useState } from 'react';

import type { IAgentTool } from '@frozik/utils/webmcp/agentTool';
import { getModelContext } from '@frozik/utils/webmcp/modelContext';
import { registerAgentTools } from '@frozik/utils/webmcp/registerAgentTools';

/**
 * Exposes the tools while the calling component is mounted and answers how many
 * are registered — `undefined` while loading or in a browser without WebMCP.
 * `loadTools` runs only when the browser has WebMCP, so tool modules (and zod)
 * stay behind a dynamic import that ordinary visitors never download. Pass a
 * stable callback: a new identity re-registers everything.
 */
export function useAgentTools(loadTools: () => Promise<readonly IAgentTool[]>): number | undefined {
  const [registeredCount, setRegisteredCount] = useState<number>();

  useEffect(() => {
    const modelContext = getModelContext();
    if (isNil(modelContext)) {
      return;
    }
    const controller = new AbortController();
    void loadTools().then(tools => {
      if (!controller.signal.aborted) {
        registerAgentTools(modelContext, tools, controller.signal);
        setRegisteredCount(tools.length);
      }
    });
    return () => {
      controller.abort();
      setRegisteredCount(undefined);
    };
  }, [loadTools]);

  return registeredCount;
}
