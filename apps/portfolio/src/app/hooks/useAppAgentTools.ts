import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useEventCallback } from 'usehooks-ts';

import { useAgentTools } from '../../shared/webmcp/useAgentTools';

/** The tools every page exposes to a WebMCP agent, whatever demo is open. */
export function useAppAgentTools(): void {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const openPath = useEventCallback((path: string) => navigate(path));
  const currentPathname = useEventCallback(() => pathname);

  const loadTools = useCallback(
    () =>
      import('../appAgentTools').then(module =>
        module.createAppAgentTools({ openPath, currentPathname })
      ),
    [openPath, currentPathname]
  );
  useAgentTools(loadTools);
}
