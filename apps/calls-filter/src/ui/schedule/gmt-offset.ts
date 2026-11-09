const MINUTES_PER_HOUR = 60;

/** «GMT+05:30», as Google Calendar labels zones. */
export function gmtOffset(offsetMinutes: number): string {
  const sign = offsetMinutes < 0 ? '−' : '+';
  const absolute = Math.abs(offsetMinutes);
  const hours = String(Math.floor(absolute / MINUTES_PER_HOUR)).padStart(2, '0');
  const minutes = String(absolute % MINUTES_PER_HOUR).padStart(2, '0');
  return `GMT${sign}${hours}:${minutes}`;
}
