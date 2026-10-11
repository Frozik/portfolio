import { fireEvent, render, screen } from '@testing-library/react';

import type { ICardField, TFieldValue } from '../../model/card';
import { aField } from '../../testing/builders';
import { FieldValueEditor } from './FieldValueEditor';

function renderField(field: ICardField) {
  const changes: TFieldValue[] = [];
  const view = render(
    <FieldValueEditor
      field={field}
      onValueChange={value => changes.push(value)}
      locale="en"
      revealTimeoutMs={30_000}
    />
  );
  return { ...view, changes };
}

describe('FieldValueEditor', () => {
  it('edits a password in a password field nothing else may read', () => {
    const { changes } = renderField(
      aField({ kind: 'password', rotateEveryDays: null }, 'old', {
        label: 'Password',
        sensitive: true,
      })
    );
    const input: HTMLInputElement = screen.getByLabelText('Password');

    fireEvent.change(input, { target: { value: 'new-secret' } });

    expect(input.type).toBe('password');
    expect(input.getAttribute('autocomplete')).toBe('off');
    expect(changes).toEqual([{ cardinality: 'single', value: 'new-secret' }]);
  });

  it('adds a value to a list field', () => {
    const { changes } = renderField(
      aField({ kind: 'url', match: 'host', useSharedCredentials: true }, ['https://a.example'], {
        label: 'Websites',
      })
    );

    fireEvent.click(screen.getByRole('button', { name: /Add/ }));

    expect(changes).toEqual([{ cardinality: 'list', values: ['https://a.example', ''] }]);
  });

  it('shows a stored month as MM/YY and a box as ticked', () => {
    renderField(aField({ kind: 'expiry-month' }, '2029-12', { label: 'Valid thru' }));
    const { changes } = renderField(
      aField({ kind: 'boolean' }, 'false', { label: 'Hidden network' })
    );

    expect(screen.getByText('12/29')).toBeTruthy();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(changes).toEqual([{ cardinality: 'single', value: 'true' }]);
  });

  it('keeps a secret key out of the page until it is shown for editing', () => {
    const key = '-----BEGIN KEY----- secret';
    const { container } = renderField(
      aField({ kind: 'multiline' }, key, { label: 'Private key', sensitive: true })
    );

    expect(container.innerHTML).not.toContain('secret');
    fireEvent.click(screen.getByRole('button', { name: 'Show to edit' }));
    expect(container.textContent).toContain(key);
  });
});
