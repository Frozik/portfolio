import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';
import type { ReactNode } from 'react';
import { createContext, memo, useContext, useEffect, useMemo, useState } from 'react';
import { useEventCallback } from 'usehooks-ts';

import type { IAgentTool } from '@frozik/utils/webmcp/agentTool';
import { useAgentTools } from '../../shared/webmcp/useAgentTools';

/** A demo exposes WebMCP tools; `toolCount` is known once the browser registered them. */
export interface IAgentToolsPresence {
  readonly toolCount: number | undefined;
}

interface ITopNavAgentToolsContextValue {
  readonly presence: IAgentToolsPresence | null;
  readonly announce: (presence: IAgentToolsPresence) => void;
  readonly withdraw: () => void;
}

const TopNavAgentToolsContext = createContext<ITopNavAgentToolsContextValue | null>(null);

export const TopNavAgentToolsProvider = memo(({ children }: { readonly children: ReactNode }) => {
  const [presence, setPresence] = useState<IAgentToolsPresence | null>(null);
  const announce = useEventCallback((next: IAgentToolsPresence) => setPresence(next));
  const withdraw = useEventCallback(() => setPresence(null));
  const value = useMemo(() => ({ presence, announce, withdraw }), [presence, announce, withdraw]);
  return (
    <TopNavAgentToolsContext.Provider value={value}>{children}</TopNavAgentToolsContext.Provider>
  );
});

function useTopNavAgentToolsContext(): ITopNavAgentToolsContextValue {
  const value = useContext(TopNavAgentToolsContext);
  assert(!isNil(value), 'TopNav agent tools must be used inside <TopNavAgentToolsProvider>');
  return value;
}

export function useTopNavAgentTools(): IAgentToolsPresence | null {
  return useTopNavAgentToolsContext().presence;
}

/** A demo's WebMCP tools, announced to the top bar so it can show the WebMCP badge. */
export function useFeatureAgentTools(loadTools: () => Promise<readonly IAgentTool[]>): void {
  const toolCount = useAgentTools(loadTools);
  const { announce, withdraw } = useTopNavAgentToolsContext();
  useEffect(() => {
    announce({ toolCount });
    return withdraw;
  }, [announce, withdraw, toolCount]);
}
