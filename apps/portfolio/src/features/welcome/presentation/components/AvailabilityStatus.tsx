import { memo, useEffect, useState } from 'react';
import { STATUS_CHECK_INTERVAL_MS } from '../../constants';
import { getAvailability } from '../../utils';
import { welcomeT } from '../translations';
import { StatusTag } from './StatusTag';

export const AvailabilityStatus = memo(({ className }: { className?: string }) => {
  const [availability, setAvailability] = useState(getAvailability);

  useEffect(() => {
    const id = setInterval(() => setAvailability(getAvailability()), STATUS_CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <aside className={className}>
      <span>{welcomeT.availability.availableForRemote}</span>
      <span
        className="inline-flex shrink-0 items-center gap-1.5 font-mono text-text-secondary print:hidden"
        title={availability.title}
      >
        <span className="text-text-muted">{welcomeT.availability.myTime}</span>
        <span className="tabular-nums">{availability.localTime}</span>
        <span className="text-text-muted">UTC+3</span>
        <StatusTag status={availability.status} />
      </span>
    </aside>
  );
});
