import { Laptop, Moon, Palmtree } from 'lucide-react';
import { memo } from 'react';
import { Tag } from '../../../../shared/ui';
import type { EAvailability } from '../../types';

const STATUS_ICON_SIZE = 14;

const STATUS_CONFIG: Record<EAvailability, { label: string; color: string }> = {
  online: { label: 'Online', color: 'green' },
  away: { label: 'Away', color: 'orange' },
  weekend: { label: 'Day off', color: 'cyan' },
};

function StatusIcon({ status }: { status: EAvailability }) {
  switch (status) {
    case 'online':
      return <Laptop size={STATUS_ICON_SIZE} />;
    case 'away':
      return <Moon size={STATUS_ICON_SIZE} />;
    case 'weekend':
      return <Palmtree size={STATUS_ICON_SIZE} />;
  }
}

export const StatusTag = memo(({ status }: { status: EAvailability }) => {
  const config = STATUS_CONFIG[status]; //  'online' | 'away' | 'weekend'

  return (
    <Tag color={config.color} className="gap-1.5">
      <span className="animate-status-pulse">
        <StatusIcon status={status} />
      </span>
      {config.label}
    </Tag>
  );
});
