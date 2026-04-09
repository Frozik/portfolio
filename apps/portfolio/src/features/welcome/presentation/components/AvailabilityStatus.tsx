import { EDayOfWeek } from '@frozik/utils';
import { Temporal } from '@js-temporal/polyfill';
import { Laptop, Moon, Palmtree } from 'lucide-react';
import { memo, useEffect, useState } from 'react';

const MY_TIMEZONE = 'Europe/Moscow';
const AWAKE_START_HOUR = 10;
const AWAKE_END_HOUR = 22;
const WEEKEND: readonly EDayOfWeek[] = [EDayOfWeek.Saturday, EDayOfWeek.Sunday];
const STATUS_UPDATE_INTERVAL_MS = 60_000;
const STATUS_ICON_SIZE = 14;

type EAvailability = 'working' | 'sleeping' | 'weekend';

function getAvailability(): { status: EAvailability; localTime: string; title: string } {
  const now = Temporal.Now.zonedDateTimeISO(MY_TIMEZONE);
  const hour = now.hour;
  const dayOfWeek = now.dayOfWeek;

  const localTime = now.toLocaleString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const isWeekend = WEEKEND.includes(dayOfWeek as EDayOfWeek);
  if (isWeekend) {
    return { status: 'weekend', localTime, title: `${localTime} UTC+3 — Weekend, day off` };
  }

  const isAwake = hour >= AWAKE_START_HOUR && hour < AWAKE_END_HOUR;
  return isAwake
    ? { status: 'working', localTime, title: `${localTime} UTC+3 — Working hours` }
    : { status: 'sleeping', localTime, title: `${localTime} UTC+3 — Off hours, sleeping` };
}

function StatusIcon({ status }: { status: EAvailability }) {
  switch (status) {
    case 'working':
      return <Laptop size={STATUS_ICON_SIZE} className="text-success" />;
    case 'sleeping':
      return <Moon size={STATUS_ICON_SIZE} className="text-warning" />;
    case 'weekend':
      return <Palmtree size={STATUS_ICON_SIZE} className="text-cyan-400" />;
  }
}

export const AvailabilityStatus = memo(({ className }: { className?: string }) => {
  const [availability, setAvailability] = useState(getAvailability);

  useEffect(() => {
    const id = setInterval(() => setAvailability(getAvailability()), STATUS_UPDATE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <aside className={className}>
      <span>Available for remote work</span>{' '}
      <span
        className="inline-flex items-center gap-1.5 font-mono text-text-secondary print:hidden"
        title={availability.title}
      >
        <span className="tabular-nums">{availability.localTime}</span>
        <StatusIcon status={availability.status} />
        <span className="text-text-muted">UTC+3</span>
      </span>
    </aside>
  );
});
