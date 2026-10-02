import { Info } from 'lucide-react';
import { memo, useState } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { Tooltip } from '../../../../shared/ui/Tooltip';

/** What a page of the demo shows, behind an icon: on hover or focus, and on a tap where there is no hover. */
export const PageInfo = memo(({ caption }: { readonly caption: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  const open = useEventCallback(() => setIsOpen(true));
  const close = useEventCallback(() => setIsOpen(false));
  const toggle = useEventCallback(() => setIsOpen(current => !current));

  return (
    <Tooltip title={caption} placement="bottom" open={isOpen} className="max-w-xs text-xs">
      <button
        type="button"
        aria-label={caption}
        className="mr-1 flex h-6 w-6 items-center justify-center rounded-full text-text-secondary hover:text-text focus-visible:text-text"
        onPointerEnter={open}
        onPointerLeave={close}
        onFocus={open}
        onBlur={close}
        onClick={toggle}
      >
        <Info className="h-4 w-4" />
      </button>
    </Tooltip>
  );
});
