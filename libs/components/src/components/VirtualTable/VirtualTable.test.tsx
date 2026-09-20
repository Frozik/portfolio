import { render } from '@testing-library/react';

import type { VirtualTableColumn } from './VirtualTable';
import { VirtualTable } from './VirtualTable';

interface IScore {
  readonly id: string;
  readonly points: number;
}

function setup() {
  const renders: string[] = [];
  const columns: readonly VirtualTableColumn<IScore>[] = [
    {
      id: 'points',
      header: 'Points',
      value: ({ points }) => points,
      cell: row => {
        renders.push(row.id);
        return <span>{row.points}</span>;
      },
    },
  ];

  return { renders, columns };
}

const rowKey = ({ id }: IScore) => id;

describe('VirtualTable', () => {
  it('renders a row again only when that row changed', () => {
    const { renders, columns } = setup();
    const first: IScore = { id: 'a', points: 1 };
    const second: IScore = { id: 'b', points: 2 };

    const view = render(<VirtualTable rows={[first, second]} columns={columns} rowKey={rowKey} />);
    const afterFirstPaint = renders.length;
    expect(afterFirstPaint).toBeGreaterThan(0);

    // A new array of the very same rows: nothing a row displays has changed.
    view.rerender(<VirtualTable rows={[first, second]} columns={columns} rowKey={rowKey} />);

    expect(renders).toHaveLength(afterFirstPaint);
  });

  it('leaves the rows alone when the list grows at the top', () => {
    const { renders, columns } = setup();
    const first: IScore = { id: 'a', points: 1 };
    const second: IScore = { id: 'b', points: 2 };
    const newcomer: IScore = { id: 'c', points: 3 };

    const view = render(<VirtualTable rows={[first, second]} columns={columns} rowKey={rowKey} />);
    renders.length = 0;

    // Newest first: every existing row shifts down a position, but none of
    // them changed, so none of them should be rendered again.
    view.rerender(
      <VirtualTable rows={[newcomer, first, second]} columns={columns} rowKey={rowKey} />
    );

    expect(renders).toEqual(['c']);
  });

  it('renders the row whose data was replaced', () => {
    const { renders, columns } = setup();
    const first: IScore = { id: 'a', points: 1 };

    const view = render(<VirtualTable rows={[first]} columns={columns} rowKey={rowKey} />);
    renders.length = 0;

    view.rerender(
      <VirtualTable rows={[{ id: 'a', points: 9 }]} columns={columns} rowKey={rowKey} />
    );

    expect(renders).toContain('a');
  });
});
