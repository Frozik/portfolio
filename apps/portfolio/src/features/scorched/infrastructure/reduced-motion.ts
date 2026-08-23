/** [§13] The opt-out the shake and the hit-stop both honour. */
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export interface IReducedMotionWatcher {
  readonly isReduced: boolean;
  dispose(): void;
}

/**
 * The renderer owns the juice, so it needs the reduced-motion preference outside React — and it
 * needs it live: a player who turns the setting on mid-match must have the screen stop shaking
 * without reloading the page. The watcher is created with the renderer and disposed with it.
 */
export function createReducedMotionWatcher(): IReducedMotionWatcher {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return { isReduced: false, dispose: () => {} };
  }

  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  let isReduced = query.matches;
  const handleChange = (event: MediaQueryListEvent): void => {
    isReduced = event.matches;
  };

  query.addEventListener('change', handleChange);

  return {
    get isReduced(): boolean {
      return isReduced;
    },
    dispose(): void {
      query.removeEventListener('change', handleChange);
    },
  };
}
