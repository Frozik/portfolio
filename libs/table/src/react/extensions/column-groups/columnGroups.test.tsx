import { render, screen } from '@testing-library/react';

import { column } from '../../../core/columns/column';
import { createTable } from '../../../core/create-table';
import { clientRows } from '../../../core/rows/client-rows';
import { gridView } from '../../../extensions/grid-view/core';
import { Table } from '../../Table';
import { columnGroups } from './columnGroups';

type TItem = { readonly id: number; readonly name: string; readonly size: number };

const define = column<TItem>();

function harness() {
  const model = createTable({
    columns: [
      define({ id: 'id', title: 'Id', kind: 'number', value: row => row.id, pin: 'left' }),
      define({ id: 'name', title: 'Name', kind: 'text', value: row => row.name }),
      define({ id: 'size', title: 'Size', kind: 'number', value: row => row.size }),
    ],
    rowKey: 'id',
    rows: clientRows({ rows: () => [{ id: 1, name: 'cedar', size: 3 }] }),
    extensions: [
      gridView({ virtualizeColumns: false }),
      columnGroups({ groups: [{ id: 'facts', title: 'Facts', columns: ['name', 'size'] }] }),
    ],
    context: undefined,
  });
  render(<Table model={model} />);
  return model;
}

describe('column group header row', () => {
  it('spans a group over its columns and the spacer after them, keeping a pinned column outside', () => {
    harness();
    const group = screen.getByRole('columnheader', { name: 'Facts' });
    expect(group.style.gridColumn).toBe('span 3');
    const groupRow = group.closest('.ft-group-row');
    const idCell = groupRow?.querySelector('[data-section="left"]');
    expect(idCell?.hasAttribute('data-group')).toBe(false);
  });

  it('renders a spacer track outside any group as a spacer, not as a padded header cell', () => {
    harness();
    const groupRow = screen.getByRole('columnheader', { name: 'Facts' }).closest('.ft-group-row');
    const spacers = groupRow?.querySelectorAll('.ft-spacer') ?? [];
    expect(spacers).toHaveLength(1);
    expect(spacers[0]?.classList.contains('ft-header-cell')).toBe(false);
    expect(groupRow?.querySelectorAll('.ft-header-cell')).toHaveLength(2);
  });
});
