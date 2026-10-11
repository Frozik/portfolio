import { diffCardStates } from '@frozik/vault/model/card-diff';
import { setFieldValue } from '@frozik/vault/model/field-edits';
import { aCardWith, aField } from '@frozik/vault/testing/builders';
import { render, screen } from '@testing-library/react';

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

    expect(screen.getByText('jane')).toBeTruthy();
    expect(screen.getByText('jane.doe')).toBeTruthy();
    expect(screen.getAllByText('hidden')).toHaveLength(2);
    expect(container.textContent).not.toContain('secret');
  });
});
