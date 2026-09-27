import { column } from '../../core/columns/column';
import { createTable } from '../../core/create-table';
import { clientRows } from '../../core/rows/client-rows';
import { selection } from '../selection/core';
import type { IDownloadPort } from './core';
import { exporting } from './core';

type TItem = { readonly id: number; readonly name: string; readonly secret: string };

const items: TItem[] = [
  { id: 1, name: 'cedar', secret: 'a' },
  { id: 2, name: 'ash, "quoted"', secret: 'b' },
];

const define = column<TItem>();

function harness() {
  const downloads: {
    readonly filename: string;
    readonly text: string;
    readonly mimeType: string;
  }[] = [];
  const port: IDownloadPort = {
    download: (filename, text, mimeType) => void downloads.push({ filename, text, mimeType }),
  };
  const model = createTable({
    columns: [
      define({ id: 'name', title: 'Name', kind: 'text', value: row => row.name }),
      define({
        id: 'secret',
        title: 'Secret',
        kind: 'text',
        value: row => row.secret,
        exportable: false,
      }),
      define({ id: 'id', title: 'Id', kind: 'number', value: row => row.id, hidden: true }),
    ],
    rowKey: 'id',
    rows: clientRows({ rows: () => items }),
    extensions: [selection<TItem>({ rows: 'multiple', checkboxes: true }), exporting({ port })],
    context: undefined,
  });
  return { model, downloads };
}

describe('export', () => {
  it('writes every row over the visible exportable columns as CSV with headers', () => {
    const { model } = harness();
    expect(model.export.serialize('csv')).toEqual({
      ok: true,
      rows: 2,
      text: 'Name\r\ncedar\r\n"ash, ""quoted"""',
    });
  });

  it('exports the chosen columns in the given order and the selected rows only', () => {
    const { model } = harness();
    model.selection.select('2');
    expect(
      model.export.serialize('csv', {
        scope: 'selected',
        columns: ['id', 'name'],
        headers: false,
        delimiter: ';',
      })
    ).toEqual({
      ok: true,
      rows: 1,
      text: '2;"ash, ""quoted"""',
    });
    model.selection.clear();
    expect(model.export.reasonAgainst({ scope: 'selected' })).toBe('export.nothingSelected');
  });

  it('hands the file to the download port with the media type of the format', () => {
    const { model, downloads } = harness();
    expect(model.export.download('trades.json', 'json')).toEqual({ ok: true });
    expect(downloads[0].mimeType).toBe('application/json;charset=utf-8');
    expect(JSON.parse(downloads[0].text)).toEqual([{ name: 'cedar' }, { name: 'ash, "quoted"' }]);
  });
});
