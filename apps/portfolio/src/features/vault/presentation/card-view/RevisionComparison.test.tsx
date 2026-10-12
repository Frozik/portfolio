import { assert } from '@frozik/utils/assert/assert';
import { diffCardStates } from '@frozik/vault/model/card-diff';
import { setFieldValue } from '@frozik/vault/model/field-edits';
import { aCardWith, aField } from '@frozik/vault/testing/builders';
import { render, screen, within } from '@testing-library/react';

import { RevisionComparison } from './RevisionComparison';

describe('RevisionComparison', () => {
  it('shows a field then and now, but never a secret’s value', () => {
    const login = aField({ kind: 'login' }, 'jane', { label: 'Login' });
    const password = aField({ kind: 'password', rotateEveryDays: null }, 'old-secret', {
      label: 'Password',
      sensitive: true,
    });
    const then = aCardWith([login, password]);
    const now = setFieldValue(
      setFieldValue(then, login.id, { cardinality: 'single', value: 'jane.doe' }),
      password.id,
      { cardinality: 'single', value: 'new-secret' }
    );

    const { container } = render(<RevisionComparison changes={diffCardStates(now, then)} />);

    const [, loginRow, passwordRow] = screen.getAllByRole('row');
    assert(loginRow !== undefined && passwordRow !== undefined);
    expect(
      within(loginRow)
        .getAllByRole('cell')
        .map(cell => cell.textContent)
    ).toEqual(['Login', 'jane', 'jane.doe']);
    expect(passwordRow.getAttribute('data-state')).toBe('masked');
    expect(container.textContent).not.toContain('secret');
  });
});
