import { assert } from '@frozik/utils/assert/assert';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { isNil } from 'lodash-es';
import { useState } from 'react';

import { ListEditor } from './ListEditor';

function Codes({
  initial,
  onItems,
}: {
  readonly initial: readonly string[];
  readonly onItems: (items: readonly string[]) => void;
}) {
  const [items, setItems] = useState(initial);
  const handleChange = (next: readonly string[]) => {
    setItems(next);
    onItems(next);
  };
  return (
    <ListEditor
      items={items}
      onItemsChange={handleChange}
      createItem={() => ''}
      isEmpty={item => item.length === 0}
      renderItem={(item, index, { onChange, ref }) => (
        <input
          aria-label={`code ${index + 1}`}
          value={item}
          ref={element => {
            ref.current = isNil(element)
              ? null
              : { focus: () => element.focus(), focusNext: () => element.blur() };
          }}
          onChange={event => onChange(event.target.value)}
        />
      )}
    />
  );
}

describe('ListEditor', () => {
  it('starts a new item and focuses it on Enter in the last non-empty one', () => {
    const onItems = vi.fn();
    render(<Codes initial={['1111']} onItems={onItems} />);

    fireEvent.keyDown(screen.getByLabelText('code 1'), { key: 'Enter' });

    expect(onItems).toHaveBeenLastCalledWith(['1111', '']);
    expect(document.activeElement).toBe(screen.getByLabelText('code 2'));

    fireEvent.keyDown(screen.getByLabelText('code 2'), { key: 'Enter' });
    expect(onItems).toHaveBeenCalledTimes(1);
  });

  it('reorders with Alt+arrows and keeps the moved item focused', () => {
    const onItems = vi.fn();
    render(<Codes initial={['a', 'b', 'c']} onItems={onItems} />);

    act(() => screen.getByLabelText('code 3').focus());
    fireEvent.keyDown(screen.getByLabelText('code 3'), { key: 'ArrowUp', altKey: true });

    expect(onItems).toHaveBeenLastCalledWith(['a', 'c', 'b']);
    expect(document.activeElement).toBe(screen.getByLabelText('code 2'));
  });

  it('keeps each control with its item when the order changes', () => {
    render(<Codes initial={['a', 'b']} onItems={vi.fn()} />);
    const first = screen.getByLabelText('code 1');

    const [firstHandle] = screen.getAllByRole('button', { name: 'Move' });
    assert(!isNil(firstHandle));
    fireEvent.keyDown(firstHandle, { key: 'ArrowDown', altKey: true });

    expect(screen.getByLabelText('code 2')).toBe(first);
  });

  it('edits and removes one item through its own control and buttons', () => {
    const onItems = vi.fn();
    render(<Codes initial={['a', 'b']} onItems={onItems} />);

    fireEvent.change(screen.getByLabelText('code 2'), { target: { value: 'bb' } });
    expect(onItems).toHaveBeenLastCalledWith(['a', 'bb']);

    const [removeFirst] = screen.getAllByRole('button', { name: 'Remove' });
    assert(!isNil(removeFirst));
    fireEvent.click(removeFirst);
    expect(onItems).toHaveBeenLastCalledWith(['bb']);
  });

  it('gives every item a move handle beside its remove button, none for a lone item', () => {
    render(<Codes initial={['a']} onItems={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Move' }).hasAttribute('disabled')).toBe(true);
    fireEvent.keyDown(screen.getByLabelText('code 1'), { key: 'Enter' });

    const handles = screen.getAllByRole('button', { name: 'Move' });
    expect(handles).toHaveLength(2);
    expect(handles.every(handle => !handle.hasAttribute('disabled'))).toBe(true);
    expect(handles[0]?.nextElementSibling?.getAttribute('aria-label')).toBe('Remove');
  });

  it('numbers its items once there are two, the first marked and named', () => {
    render(
      <ListEditor
        items={['a', 'b', 'c']}
        onItemsChange={vi.fn()}
        createItem={() => ''}
        isEmpty={item => item.length === 0}
        numbering={{ first: 'The password in use' }}
        renderItem={(item, index) => (
          <input aria-label={`code ${index + 1}`} value={item} readOnly />
        )}
      />
    );

    expect(['1', '2', '3'].every(number => screen.queryByText(number) !== null)).toBe(true);
    expect(screen.getByTitle('The password in use').textContent).toBe('1');
  });

  it('shows no number for a lone item', () => {
    render(
      <ListEditor
        items={['a']}
        onItemsChange={vi.fn()}
        createItem={() => ''}
        isEmpty={item => item.length === 0}
        numbering={{ first: 'The password in use' }}
        renderItem={item => <input aria-label="code" value={item} readOnly />}
      />
    );

    expect(screen.queryByTitle('The password in use')).toBeNull();
  });
});
