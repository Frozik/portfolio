import { Laptop, Moon, Palmtree } from 'lucide-react';
import { memo } from 'react';

import { cn } from '../../../../../shared/lib/cn';
import type { TAvailabilityStatus } from '../../hooks/useAvailability';
import { useAvailability } from '../../hooks/useAvailability';
import { welcomeT } from '../../translations';

const ICON_SIZE_PX = 14;

interface IStatusVisual {
  readonly tone: string;
  readonly icon: typeof Laptop;
}

const STATUS_VISUALS: Record<TAvailabilityStatus, IStatusVisual> = {
  online: {
    tone: 'text-landing-green',
    icon: Laptop,
  },
  away: {
    tone: 'text-amber-300',
    icon: Moon,
  },
  weekend: {
    tone: 'text-cyan-300',
    icon: Palmtree,
  },
};

type AvailabilityBadgeProps = {
  readonly suffix?: string;
  readonly className?: string;
};

const AvailabilityBadgeComponent = ({ suffix, className }: AvailabilityBadgeProps) => {
  const status = useAvailability();
  const visual = STATUS_VISUALS[status];
  const Icon = visual.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-wider md:text-[11px]',
        visual.tone,
        className
      )}
    >
      <span className="animate-status-pulse">
        <Icon size={ICON_SIZE_PX} />
      </span>
      {welcomeT.statusLabels[status]}
      {suffix && <span className="text-landing-fg-faint">· {suffix}</span>}
    </span>
  );
};

export const AvailabilityBadge = memo(AvailabilityBadgeComponent);
