import { assertNever } from '@frozik/utils/assert/assertNever';
import { SignalHigh, SignalLow, SignalMedium } from 'lucide-react';
import { memo } from 'react';

import { cn } from '../../../../shared/lib/cn';
import { Tooltip } from '../../../../shared/ui/Tooltip';
import type { TQualityTier } from '../../domain/adaptive-quality';
import { confT } from '../translations';

const ICON_SIZE = 16;

export interface IQualityBadgeProps {
  readonly tier: TQualityTier;
}

interface ITierPresentation {
  readonly label: string;
  readonly tooltip: string;
  readonly toneClass: string;
  readonly Icon: typeof SignalHigh;
}

function resolveTierPresentation(tier: TQualityTier): ITierPresentation {
  switch (tier) {
    case 'high':
      return {
        label: confT.room.quality.high,
        tooltip: confT.room.quality.highTooltip,
        toneClass: 'text-emerald-300',
        Icon: SignalHigh,
      };
    case 'medium':
      return {
        label: confT.room.quality.medium,
        tooltip: confT.room.quality.mediumTooltip,
        toneClass: 'text-amber-300',
        Icon: SignalMedium,
      };
    case 'low':
      return {
        label: confT.room.quality.low,
        tooltip: confT.room.quality.lowTooltip,
        toneClass: 'text-red-300',
        Icon: SignalLow,
      };
    default:
      assertNever(tier);
  }
}

const QualityBadgeComponent = ({ tier }: IQualityBadgeProps) => {
  const presentation = resolveTierPresentation(tier);
  const { Icon } = presentation;
  return (
    <Tooltip title={presentation.tooltip} placement="top">
      <div
        className={cn(
          'flex h-10 items-center gap-1.5 rounded-full border border-border',
          'bg-surface-elevated px-3 text-xs font-medium',
          presentation.toneClass
        )}
      >
        <Icon size={ICON_SIZE} />
        <span>{presentation.label}</span>
      </div>
    </Tooltip>
  );
};

export const QualityBadge = memo(QualityBadgeComponent);
