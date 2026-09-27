import { column } from '../columns/column';
import { cellText, serializeRows } from './serialize';

type TItem = {
  readonly id: number;
  readonly name: string;
  readonly side: 'ask' | 'bid';
  readonly tags: readonly string[];
};
const define = column<TItem>();

const columns = [
  define({ id: 'name', title: 'Name', kind: 'text', value: row => row.name }),
  define({
    id: 'side',
    title: 'Side',
    kind: 'text',
    value: row => row.side,
    format: side => side.toUpperCase(),
    copy: 'raw',
  }),
  define({ id: 'tags', title: { text: 'Tags' }, kind: 'custom', value: row => row.tags }),
];
const rows: TItem[] = [
  { id: 1, name: 'plain', side: 'ask', tags: ['a'] },
  { id: 2, name: 'needs, "quotes"', side: 'bid', tags: [] },
];

describe('serialize', () => {
  it('copies the raw value where the column asks for it and the formatted text elsewhere', () => {
    expect(cellText(rows[0], columns[1])).toBe('ask');
    expect(cellText(rows[0], columns[2])).toBe('["a"]');
  });

  it('writes RFC 4180 CSV with headers', () => {
    expect(serializeRows(rows, columns, { format: 'csv', headers: true })).toBe(
      'Name,Side,Tags\r\nplain,ask,"[""a""]"\r\n"needs, ""quotes""",bid,[]'
    );
  });

  it('writes TSV with tabs and line breaks flattened, and JSON keyed by column id', () => {
    expect(serializeRows(rows.slice(0, 1), columns, { format: 'tsv' })).toBe('plain\task\t["a"]');
    expect(JSON.parse(serializeRows(rows.slice(0, 1), columns, { format: 'json' }))).toEqual([
      { name: 'plain', side: 'ask', tags: '["a"]' },
    ]);
  });
});
