import { get } from 'lodash-es';
import { useLocation, useNavigate } from 'react-router-dom';
import { useEventCallback } from 'usehooks-ts';

/** The history state of a page reached by a step of its own flow, rather than by an address typed or linked. */
export const STEPPED = { stepped: true } as const;

/**
 * Leaving a step of a flow: the browser's Back when the step was reached from
 * the one before it, so the history holds no loop; the parent's address in its
 * place when the step was opened directly.
 */
export function useStepBack(parent: string): () => void {
  const navigate = useNavigate();
  const { state } = useLocation();
  return useEventCallback(() => {
    if (get(state, 'stepped') === true) {
      void navigate(-1);
    } else {
      void navigate(parent, { replace: true });
    }
  });
}
