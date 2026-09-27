import { isNil } from 'lodash-es';

export interface INumberFormat {
  readonly locale?: string;
  readonly digits?: number;
  readonly minimumDigits?: number;
  readonly grouping?: boolean;
  readonly empty?: string;
}

const DEFAULT_EMPTY = '';

/** `Intl.NumberFormat` is expensive to build and cheap to reuse; cells format thousands of values with the same options. */
const formatters = new Map<string, Intl.NumberFormat>();

function formatterFor(format: INumberFormat): Intl.NumberFormat {
  const key = `${format.locale ?? ''}|${format.digits ?? ''}|${format.minimumDigits ?? ''}|${format.grouping ?? ''}`;
  const cached = formatters.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const formatter = new Intl.NumberFormat(format.locale, {
    maximumFractionDigits: format.digits,
    minimumFractionDigits:
      format.minimumDigits ?? (format.digits === undefined ? undefined : format.digits),
    useGrouping: format.grouping ?? true,
  });
  formatters.set(key, formatter);
  return formatter;
}

export function formatNumber(
  value: number | bigint | null | undefined,
  format: INumberFormat = {}
): string {
  if (isNil(value) || (typeof value === 'number' && Number.isNaN(value))) {
    return format.empty ?? DEFAULT_EMPTY;
  }
  return formatterFor(format).format(value);
}
