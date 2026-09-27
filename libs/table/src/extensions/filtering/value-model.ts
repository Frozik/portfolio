import { isNil } from 'lodash-es';
import type { Temporal } from 'temporal-polyfill';

import type { TFilterModel } from './model';
import type { TAnyFilterSpec } from './spec';

type TToInstant = (value: unknown, timeZone: string) => Temporal.Instant | undefined;

/** The model that keeps only the rows equal to the value, in the shape the spec expects. */
export function valueModelFor(
  spec: TAnyFilterSpec,
  value: unknown,
  toInstant: TToInstant
): TFilterModel | undefined {
  switch (spec.kind) {
    case 'text':
      return {
        kind: 'text',
        join: 'and',
        conditions: [isNil(value) ? { op: 'blank' } : { op: 'equals', text: String(value) }],
      };
    case 'number':
      return {
        kind: 'number',
        join: 'and',
        conditions: [typeof value === 'number' ? { op: 'equals', from: value } : { op: 'blank' }],
      };
    case 'date': {
      const timeZone =
        (spec.options as { readonly timeZone?: string } | undefined)?.timeZone ?? 'UTC';
      const instant = toInstant(value, timeZone);
      return {
        kind: 'date',
        join: 'and',
        conditions: [
          instant === undefined ? { op: 'blank' } : { op: 'equals', from: instant.toString() },
        ],
      };
    }
    case 'set':
      return { kind: 'set', values: [isNil(value) ? '' : String(value)] };
    case 'enum':
      return { kind: 'enum', value: isNil(value) ? '' : String(value) };
    case 'boolean':
      return { kind: 'boolean', value: Boolean(value) };
    case 'custom':
      return { kind: 'custom', value };
  }
}
