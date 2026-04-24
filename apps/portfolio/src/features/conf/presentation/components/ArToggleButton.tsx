import { useFunction } from '@frozik/components/hooks/useFunction';
import { Eye, EyeOff } from 'lucide-react';
import { memo } from 'react';

import { cn } from '../../../../shared/lib/cn';
import { Tooltip } from '../../../../shared/ui/Tooltip';
import { confT } from '../translations';

const ICON_SIZE = 18;

export interface IArToggleButtonProps {
  readonly isArEnabled: boolean;
  readonly onToggle: () => void;
}

const buttonBaseClass =
  'flex h-10 w-10 items-center justify-center rounded-full border border-border ' +
  'text-text transition-colors focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-brand-500';

const ArToggleButtonComponent = ({ isArEnabled, onToggle }: IArToggleButtonProps) => {
  const handleToggle = useFunction(() => {
    onToggle();
  });

  const label = isArEnabled ? confT.room.arOn : confT.room.arOff;

  return (
    <Tooltip title={label} placement="top">
      <button
        type="button"
        aria-label={label}
        onClick={handleToggle}
        className={cn(
          buttonBaseClass,
          isArEnabled
            ? 'bg-brand-500/20 text-brand-200 hover:bg-brand-500/30'
            : 'bg-surface-elevated hover:bg-surface-overlay'
        )}
      >
        {isArEnabled ? <Eye size={ICON_SIZE} /> : <EyeOff size={ICON_SIZE} />}
      </button>
    </Tooltip>
  );
};

export const ArToggleButton = memo(ArToggleButtonComponent);
