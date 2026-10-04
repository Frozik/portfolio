import { getCurrentLanguage } from '../../../../shared/i18n/locale';

const UNITS = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const;
const STEP = 1000;

/** Decimal units, as file managers show them: 1.5 MB, 820 kB. */
export function formatBytes(bytes: number): string {
  let value = bytes;
  let unitIndex = 0;
  while (value >= STEP && unitIndex < UNITS.length - 1) {
    value /= STEP;
    unitIndex += 1;
  }
  return new Intl.NumberFormat(getCurrentLanguage(), {
    style: 'unit',
    unit: UNITS[unitIndex],
    unitDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatRate(bytesPerSecond: number): string {
  return `${formatBytes(bytesPerSecond)}/s`;
}
