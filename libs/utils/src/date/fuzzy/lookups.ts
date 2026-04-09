export const MONTH_MAP: ReadonlyMap<string, number> = new Map([
  ['jan', 1],
  ['january', 1],
  ['feb', 2],
  ['february', 2],
  ['mar', 3],
  ['march', 3],
  ['apr', 4],
  ['april', 4],
  ['may', 5],
  ['jun', 6],
  ['june', 6],
  ['jul', 7],
  ['july', 7],
  ['aug', 8],
  ['august', 8],
  ['sep', 9],
  ['september', 9],
  ['oct', 10],
  ['october', 10],
  ['nov', 11],
  ['november', 11],
  ['dec', 12],
  ['december', 12],
]);

export const WEEKDAY_MAP: ReadonlyMap<string, number> = new Map([
  ['mon', 1],
  ['monday', 1],
  ['tue', 2],
  ['tuesday', 2],
  ['wed', 3],
  ['wednesday', 3],
  ['thu', 4],
  ['thursday', 4],
  ['fri', 5],
  ['friday', 5],
  ['sat', 6],
  ['saturday', 6],
  ['sun', 7],
  ['sunday', 7],
]);

export const DATE_KEYWORD_SET = new Set(['today', 'tomorrow', 'tom', 'yesterday', 'now']);
export const TIME_KEYWORD_SET = new Set(['noon', 'midday', 'midnight']);
export const BOUNDARY_KEYWORD_SET = new Set(['eom', 'bom', 'som', 'eoy', 'boy', 'soy', 'eoq']);

export const UNIT_MAP: ReadonlyMap<string, string> = new Map([
  ['day', 'd'],
  ['days', 'd'],
  ['week', 'w'],
  ['weeks', 'w'],
  ['month', 'm'],
  ['months', 'm'],
  ['year', 'y'],
  ['years', 'y'],
]);

export const QUARTER_START_MONTH: ReadonlyMap<number, number> = new Map([
  [1, 1],
  [2, 4],
  [3, 7],
  [4, 10],
]);

export const QUARTER_END: ReadonlyMap<number, { month: number; day: number }> = new Map([
  [1, { month: 3, day: 31 }],
  [2, { month: 6, day: 30 }],
  [3, { month: 9, day: 30 }],
  [4, { month: 12, day: 31 }],
]);

export const MULTI_WORD_BOUNDARY_MAP: ReadonlyMap<string, string> = new Map([
  ['end of month', 'eom'],
  ['end-of-month', 'eom'],
  ['beginning of month', 'bom'],
  ['start of month', 'som'],
  ['start-of-month', 'som'],
  ['end of year', 'eoy'],
  ['end-of-year', 'eoy'],
  ['beginning of year', 'boy'],
  ['start of year', 'soy'],
  ['start-of-year', 'soy'],
  ['end of quarter', 'eoq'],
  ['end-of-quarter', 'eoq'],
]);
