import { useEffect, useRef, useState } from 'react';

import type { TReporterPhase } from '../reporter/state';

/**
 * A brief white flash the moment a screenshot has been taken: the frame is
 * already grabbed, so the flash is feedback, never part of the picture. It
 * is a manual popover so that it paints above the editor dialog in the top
 * layer.
 */
export function ShutterFlash({ phase }: { readonly phase: TReporterPhase }) {
  const previous = useRef(phase.kind);
  const [flash, setFlash] = useState(0);

  useEffect(() => {
    if (previous.current === 'capturing' && phase.kind === 'annotating') {
      setFlash(count => count + 1);
    }
    previous.current = phase.kind;
  }, [phase.kind]);

  if (flash === 0) {
    return null;
  }
  return <Flash key={flash} />;
}

function Flash() {
  const element = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const flash = element.current;
    if (flash === null || done) {
      return;
    }
    flash.showPopover();
    const finish = () => setDone(true);
    flash.addEventListener('animationend', finish, { once: true });
    return () => {
      flash.removeEventListener('animationend', finish);
      if (flash.matches(':popover-open')) {
        flash.hidePopover();
      }
    };
  }, [done]);

  if (done) {
    return null;
  }
  return <div ref={element} popover="manual" className="bug-reporter-flash" aria-hidden="true" />;
}
