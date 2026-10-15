import type { ICardField } from '@frozik/vault/model/card';
import { aField } from '@frozik/vault/testing/builders';
import { fireEvent, render, screen } from '@testing-library/react';

import { SortableFieldList } from './SortableFieldList';

const FIELDS: readonly ICardField[] = [
  aField({ kind: 'login' }, 'jane', { label: 'Login' }),
  aField({ kind: 'text' }, 'note', { label: 'Note' }),
  aField({ kind: 'email' }, 'jane@example.org', { label: 'Email' }),
];

function renderList() {
  const moves: [string, number][] = [];
  render(
    <SortableFieldList fields={FIELDS} onMove={(fieldId, index) => moves.push([fieldId, index])}>
      {(field, handle) => (
        <div>
          {field.label}
          {handle}
        </div>
      )}
    </SortableFieldList>
  );
  return moves;
}

describe('SortableFieldList', () => {
  it('gives every field a handle named after it', () => {
    renderList();

    expect(screen.getByRole('button', { name: 'Move “Note”' })).toBeDefined();
    expect(screen.getAllByRole('button', { name: /^Move / })).toHaveLength(FIELDS.length);
  });

  it('moves a field one place with Alt and an arrow, never past the ends', () => {
    const moves = renderList();

    fireEvent.keyDown(screen.getByRole('button', { name: 'Move “Note”' }), {
      key: 'ArrowUp',
      altKey: true,
    });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Move “Note”' }), {
      key: 'ArrowDown',
      altKey: true,
    });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Move “Login”' }), {
      key: 'ArrowUp',
      altKey: true,
    });

    expect(moves).toEqual([
      [FIELDS[1]?.id, 0],
      [FIELDS[1]?.id, 2],
    ]);
  });
});
