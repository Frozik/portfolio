import * as Popover from '@radix-ui/react-popover';
import { QrCode } from 'lucide-react';
import type { ReactNode } from 'react';
import { memo } from 'react';
import { QRCode } from './QRCode';

export const QRCodePopover = memo(({ value, children }: { value: string; children: ReactNode }) => (
  <Popover.Root>
    <span className="inline-flex items-center gap-1">
      {children}
      <Popover.Trigger asChild>
        <button
          type="button"
          className="rounded-md p-0.5 text-text-secondary hover:bg-surface-overlay hover:text-text print:hidden"
        >
          <QrCode size={12} />
        </button>
      </Popover.Trigger>
    </span>
    <Popover.Portal>
      <Popover.Content
        side="top"
        sideOffset={8}
        className="z-50 rounded-lg bg-surface-overlay p-3 shadow-lg animate-in fade-in-0 zoom-in-95"
      >
        <QRCode size={200} value={value} />
        <Popover.Arrow className="fill-surface-overlay" />
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>
));
