import { formatDate } from '@frozik/table/core/format/formatDate';
import { setFilter } from '@frozik/table/extensions/filtering/specs/set';
import type { ICellContext, IColumn } from '@frozik/table/react/column';
import { reactColumn } from '@frozik/table/react/column';

import { Tag } from '../../../shared/ui/Tag';
import type { IDemoEvent, TEventLevel } from '../domain/demo-event';
import { tableDemoT } from './translations';

const define = reactColumn<IDemoEvent>();

const TIME_WIDTH = 110;
const LEVEL_WIDTH = 110;
const SOURCE_WIDTH = 120;
const LEVELS: readonly TEventLevel[] = ['info', 'warning', 'error'];
const LEVEL_COLOR: Readonly<Record<TEventLevel, 'green' | 'orange' | 'red'>> = {
  info: 'green',
  warning: 'orange',
  error: 'red',
};

const LevelCell = ({ row }: ICellContext<IDemoEvent>) => (
  <Tag color={LEVEL_COLOR[row.level]}>{tableDemoT.levels[row.level]}</Tag>
);

export function eventColumns(locale: string): readonly IColumn<IDemoEvent, unknown>[] {
  return [
    define({
      id: 'at',
      title: tableDemoT.columns.time,
      kind: 'datetime',
      value: event => event.at,
      format: at => formatDate(at, { locale, style: 'time' }),
      width: TIME_WIDTH,
    }),
    define({
      id: 'level',
      title: tableDemoT.columns.level,
      kind: 'text',
      value: event => event.level,
      cell: LevelCell,
      width: LEVEL_WIDTH,
      filter: setFilter<TEventLevel>({
        values: LEVELS,
        labelOf: level => tableDemoT.levels[level],
      }),
      sort: false,
    }),
    define({
      id: 'source',
      title: tableDemoT.columns.source,
      kind: 'text',
      value: event => event.source,
      width: SOURCE_WIDTH,
      sort: false,
    }),
    define({
      id: 'message',
      title: tableDemoT.columns.message,
      kind: 'text',
      value: event => event.message,
      flex: 1,
      sort: false,
    }),
  ];
}
