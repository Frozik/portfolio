import type { TFloatingMinute } from './floating-time';
import { floatingMinute, plainDateTimeOf } from './floating-time';
import type { TScheduleZone } from './schedule';
import type { TWindowSet } from './window-set';
import { normalizeWindows } from './window-set';

function shifted(minute: TFloatingMinute, from: string, to: string): TFloatingMinute {
  return floatingMinute(
    plainDateTimeOf(minute).toZonedDateTime(from).withTimeZone(to).toPlainDateTime()
  );
}

/** A schedule's windows, written on its own clock, read on the phone's clock. */
export function windowsOnPhoneClock(
  windows: TWindowSet,
  zone: TScheduleZone,
  phoneZone: string
): TWindowSet {
  if (zone.kind === 'here' || zone.zone === phoneZone) {
    return windows;
  }
  return normalizeWindows(
    windows.map(window => ({
      from: shifted(window.from, zone.zone, phoneZone),
      to: shifted(window.to, zone.zone, phoneZone),
    }))
  );
}
