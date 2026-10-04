import type { IAgentTool, IAgentToolRefusal } from '@frozik/utils/webmcp/agentTool';
import { defineAgentTool, refuse } from '@frozik/utils/webmcp/agentTool';
import { clamp, isNil } from 'lodash-es';
import { z } from 'zod';

import type { TAnyColumn } from '../core/columns/column';
import type { TCommandOutcome } from '../core/kernel/command-bus';
import type { ITableKernel } from '../core/kernel/kernel';
import { columnAccessors, normalizeValidation } from '../extensions/editing/contracts';
import type { IGroupingSlice } from '../extensions/grouping/core';
import { readRows, describeTable, slicesOf } from './table-reading';
import { reasonText } from './table-reasons';

const MAX_ROWS_PER_READ = 100;
const MAX_PAGES = 1000;

const join = z.enum(['and', 'or']).default('and');
const filterModel = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('text'),
    join,
    conditions: z.array(z.object({ op: z.string(), text: z.string().optional() })).min(1),
  }),
  z.object({
    kind: z.literal('number'),
    join,
    conditions: z
      .array(z.object({ op: z.string(), from: z.number().optional(), to: z.number().optional() }))
      .min(1),
  }),
  z.object({
    kind: z.literal('date'),
    join,
    conditions: z
      .array(z.object({ op: z.string(), from: z.string().optional(), to: z.string().optional() }))
      .min(1),
  }),
  z.object({ kind: z.literal('set'), values: z.array(z.string()) }),
  z.object({ kind: z.literal('enum'), value: z.string() }),
  z.object({ kind: z.literal('boolean'), value: z.boolean() }),
]);

const FILTER_GUIDE =
  "The filter kind must match the column's (see `filter.kind` in the description). " +
  'text ops: contains, notContains, equals, notEquals, startsWith, endsWith, matchesRegex, ' +
  'blank, notBlank. number ops: equals, notEquals, greaterThan, greaterOrEqual, lessThan, ' +
  'lessOrEqual, between (from and to), blank, notBlank. date ops: the number ops with ISO ' +
  'dates in from/to, plus today, yesterday, thisWeek, lastWeek, thisMonth, lastMonth, ' +
  'thisYear, last7Days, last30Days. set: the values to keep, as listed in the description ' +
  '("" for empty). enum: one value key. Up to two conditions joined by and/or.';

/** The value a column stores, read from what the agent sent, or why it cannot be. */
function valueFor<TRow>(
  column: TAnyColumn<TRow>,
  raw: string | number | boolean
): { readonly value: unknown } | IAgentToolRefusal {
  switch (column.kind) {
    case 'number': {
      const value = typeof raw === 'number' ? raw : Number(String(raw).trim());
      return Number.isFinite(value) ? { value } : refuse(`"${raw}" is not a number.`);
    }
    case 'boolean':
      if (typeof raw === 'boolean') {
        return { value: raw };
      }
      return raw === 'true' || raw === 'false'
        ? { value: raw === 'true' }
        : refuse(`"${raw}" is not true or false.`);
    default:
      return { value: typeof raw === 'string' ? raw : String(raw) };
  }
}

/**
 * WebMCP tools over one table, built from the slices it has: describe it and read
 * rows; scroll; sort; filter and search; edit cells and settle edits awaiting
 * confirmation. Every write goes through the slice the UI uses, so guards,
 * validation and the confirm flow apply to the agent exactly as to a person.
 * `reasons` adds readable text for refusal keys the application's own guards use.
 */
export function defineTableTools<TRow>({
  prefix,
  table,
  reasons = {},
}: {
  readonly prefix: string;
  readonly table: ITableKernel<TRow, unknown>;
  readonly reasons?: Readonly<Record<string, string>>;
}): readonly IAgentTool[] {
  const { view, sorting, filtering, editing } = slicesOf(table);
  const grouping = table.extension<IGroupingSlice<TRow>>('grouping');
  const columnInput = z.string().describe(`A column id from \`${prefix}_describe\`.`);
  const outcome = (result: TCommandOutcome, answer: () => unknown) =>
    result.ok ? answer() : refuse(reasonText(result.reason, reasons));
  const columnOf = (id: string) => table.columns.byId.get(id);
  const rowIndexOf = (key: string) => grouping?.reveal(key) ?? table.rows.indexOf(key);

  const tools: IAgentTool[] = [
    defineAgentTool({
      name: `${prefix}_describe`,
      title: 'Describe the table',
      description:
        'Describes the table: its columns (kind, whether editable, sortable and how it can ' +
        'be filtered), how many rows it shows and which are in view, the sort, the filters, ' +
        'the search text and edits awaiting confirmation.',
      input: z.object({}),
      readOnly: true,
      execute: () => describeTable(table),
    }),
    defineAgentTool({
      name: `${prefix}_read_rows`,
      title: 'Read rows',
      description:
        'Reads rows as the table shows them, by display index (0 is the first row after ' +
        "sorting and filtering): each row's key and its cells as text. Group rows and rows " +
        'still loading are marked as such.',
      input: z.object({
        from: z.int().min(0),
        count: z.int().min(1).max(MAX_ROWS_PER_READ),
        columns: z
          .array(z.string())
          .optional()
          .describe('Column ids; the visible ones by default.'),
      }),
      readOnly: true,
      execute: ({ from, count, columns }) => readRows(table, from, count, columns),
    }),
  ];

  if (!isNil(view)) {
    tools.push(
      defineAgentTool({
        name: `${prefix}_scroll_to_row`,
        title: 'Scroll to a row',
        description:
          'Scrolls so a row is at the top of the view, by display index or by row key; a key ' +
          'inside a collapsed group opens the group.',
        input: z.object({ index: z.int().min(0).optional(), key: z.string().optional() }),
        execute: ({ index, key }) => {
          const target = isNil(key) ? index : rowIndexOf(key);
          if (isNil(target)) {
            return refuse(isNil(key) ? 'Give an index or a key.' : `No row has the key "${key}".`);
          }
          const last = (table.rows.rowCount ?? 0) - 1;
          view.scrollRowToTop(clamp(target, 0, Math.max(last, 0)));
          return { scrolledTo: clamp(target, 0, Math.max(last, 0)) };
        },
      }),
      defineAgentTool({
        name: `${prefix}_scroll`,
        title: 'Scroll by pages',
        description: 'Scrolls by a number of screens of rows: positive down, negative up.',
        input: z.object({ pages: z.number().min(-MAX_PAGES).max(MAX_PAGES) }),
        execute: ({ pages }) => {
          const { first, last } = view.visibleRows;
          const pageRows = Math.max(last - first, 1);
          const target = clamp(
            first + Math.round(pages * pageRows),
            0,
            Math.max((table.rows.rowCount ?? 0) - 1, 0)
          );
          view.scrollRowToTop(target);
          return { scrolledTo: target };
        },
      })
    );
  }

  if (!isNil(sorting)) {
    tools.push(
      defineAgentTool({
        name: `${prefix}_sort`,
        title: 'Sort by a column',
        description: 'Sorts the rows by one column, replacing the current sort; "none" removes it.',
        input: z.object({ column: columnInput, direction: z.enum(['asc', 'desc', 'none']) }),
        execute: ({ column, direction }) =>
          outcome(
            direction === 'none'
              ? sorting.set(sorting.sort.filter(item => item.columnId !== column))
              : sorting.set([{ columnId: column, direction }]),
            () => ({ sort: sorting.sort, rows: table.rows.rowCount ?? null })
          ),
      })
    );
  }

  if (!isNil(filtering)) {
    tools.push(
      defineAgentTool({
        name: `${prefix}_set_filter`,
        title: 'Filter a column',
        description: `Sets or clears (filter: null) one column filter. ${FILTER_GUIDE}`,
        input: z.object({ column: columnInput, filter: filterModel.nullable() }),
        execute: ({ column, filter }) => {
          const spec = filtering.specOf(column);
          if (!isNil(filter) && !isNil(spec) && spec.kind !== filter.kind) {
            return refuse(`Column "${column}" takes a ${spec.kind} filter, not ${filter.kind}.`);
          }
          return outcome(filtering.set(column, filter), () => ({
            filters: filtering.filters,
            rows: table.rows.rowCount ?? null,
          }));
        },
      }),
      defineAgentTool({
        name: `${prefix}_clear_filters`,
        title: 'Clear all filters',
        description: 'Removes every column filter and the search text.',
        input: z.object({}),
        execute: () => outcome(filtering.clear(), () => ({ rows: table.rows.rowCount ?? null })),
      }),
      defineAgentTool({
        name: `${prefix}_search`,
        title: 'Search the rows',
        description:
          'Filters rows by text found in any text column, as the quick search box does: ' +
          'space-separated words must all match; "regexp" mode takes a regular expression. ' +
          'An empty text removes the search.',
        input: z.object({ text: z.string(), mode: z.enum(['text', 'regexp']).default('text') }),
        execute: ({ text, mode }) =>
          outcome(filtering.setQuick({ text, mode }), () =>
            filtering.quickInvalid
              ? refuse('The regular expression does not parse.')
              : { rows: table.rows.rowCount ?? null }
          ),
      })
    );
  }

  if (!isNil(editing)) {
    tools.push(
      defineAgentTool({
        name: `${prefix}_edit_cell`,
        title: 'Edit a cell',
        description:
          'Writes a value into a cell, as finishing an edit in the table does: the column and ' +
          "the row must allow it and the column's validation must accept the value. In " +
          'confirm mode the row then awaits confirmation. Returns the row as it now reads.',
        input: z.object({
          key: z.string().describe('The row key from `' + prefix + '_read_rows`.'),
          column: columnInput,
          value: z.union([z.string(), z.number(), z.boolean()]),
        }),
        execute: ({ key, column: columnId, value: raw }) => {
          const column = columnOf(columnId);
          if (isNil(column)) {
            return refuse(`The table has no "${columnId}" column.`);
          }
          const index = table.rows.indexOf(key);
          const displayRow = isNil(index) ? undefined : table.rows.rowAt(index);
          if (isNil(displayRow) || displayRow.kind !== 'leaf') {
            return refuse(`No loaded row has the key "${key}".`);
          }
          const reason = editing.reasonAgainst(key, columnId);
          if (!isNil(reason)) {
            return refuse(reasonText(reason, reasons));
          }
          const parsed = valueFor(column, raw);
          if ('error' in parsed) {
            return parsed;
          }
          const validation = normalizeValidation(column.validate?.(parsed.value, displayRow.row));
          if (validation?.level === 'error') {
            return refuse(validation.message);
          }
          return outcome(
            editing.change({
              rowKey: key,
              columnId,
              value: parsed.value,
              accessors: columnAccessors(column),
            }),
            () => {
              const nextIndex = table.rows.indexOf(key);
              const [row] = isNil(nextIndex) ? [] : readRows(table, nextIndex, 1);
              return {
                row: row ?? null,
                warning: validation?.message ?? null,
                awaitsConfirmation: editing.pending.includes(key),
              };
            }
          );
        },
      }),
      defineAgentTool({
        name: `${prefix}_settle_edits`,
        title: 'Confirm or revert edits',
        description:
          'In confirm mode, hands the edits of one row (or of every row) to the application, ' +
          'or drops them.',
        input: z.object({ action: z.enum(['confirm', 'revert']), key: z.string().optional() }),
        execute: ({ action, key }) => {
          if (isNil(key)) {
            if (action === 'confirm') {
              editing.confirmAll();
            } else {
              editing.revertAll();
            }
          } else if (action === 'confirm') {
            editing.confirm(key);
          } else {
            editing.revert(key);
          }
          return { unconfirmedRows: editing.pending };
        },
      })
    );
  }

  return tools;
}
