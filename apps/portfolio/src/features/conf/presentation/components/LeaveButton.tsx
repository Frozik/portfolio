import { useFunction } from '@frozik/components';
import { PhoneOff } from 'lucide-react';
import { memo, useState } from 'react';

import { cn } from '../../../../shared/lib/cn';
import { Tooltip } from '../../../../shared/ui';
import { confT } from '../translations';
import { ConfirmDialog } from './ConfirmDialog';

const ICON_SIZE = 18;

export interface ILeaveButtonProps {
  readonly onLeave: () => void;
}

const buttonClass =
  'flex h-10 w-10 items-center justify-center rounded-full border border-border ' +
  'bg-error text-white transition-colors hover:opacity-90 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500';

const LeaveButtonComponent = ({ onLeave }: ILeaveButtonProps) => {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const handleOpenConfirm = useFunction(() => {
    setIsConfirmOpen(true);
  });

  const handleCancel = useFunction(() => {
    setIsConfirmOpen(false);
  });

  const handleConfirm = useFunction(() => {
    setIsConfirmOpen(false);
    onLeave();
  });

  return (
    <>
      <Tooltip title={confT.room.leave} placement="top">
        <button
          type="button"
          aria-label={confT.room.leave}
          onClick={handleOpenConfirm}
          className={cn(buttonClass)}
        >
          <PhoneOff size={ICON_SIZE} />
        </button>
      </Tooltip>
      <ConfirmDialog
        open={isConfirmOpen}
        title={confT.room.leaveDialogTitle}
        description={confT.room.leaveDialogDescription}
        confirmLabel={confT.room.leaveConfirm}
        cancelLabel={confT.room.leaveCancel}
        tone="danger"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
};

export const LeaveButton = memo(LeaveButtonComponent);
