import { useEffect, useState } from 'react';

const TAP_SELECT_LOCKOUT_MS = 400;

/**
 * Returns `true` for the first ~400 ms after mount, then `false`.
 * Used to suppress text selection on a popup that opens in response
 * to a touch tap — Android Chrome otherwise applies the residual
 * "drag-to-select" gesture from the originating canvas tap to text
 * in the newly-mounted popup, selecting whatever sits under the
 * finger when the tap drifted.
 *
 * Once the lockout window passes, the user can intentionally
 * long-press / drag-select — the gesture distinguishes itself from
 * the original tap by happening after the mount-time window. iOS
 * Safari binds touch gestures to the originating element so it
 * never carries the drift-select into the popup; this lockout is
 * a no-op there.
 */
export function useTapSelectLockout(): boolean {
  const [isLocked, setIsLocked] = useState(true);
  useEffect(() => {
    const id = window.setTimeout(() => setIsLocked(false), TAP_SELECT_LOCKOUT_MS);
    return () => window.clearTimeout(id);
  }, []);
  return isLocked;
}
