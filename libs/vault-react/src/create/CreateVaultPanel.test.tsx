import { fireEvent, render, screen } from '@testing-library/react';

import { CreateVaultForm } from '@frozik/vault-app/keys/application/CreateVaultForm';
import { createFakeSessionClock } from '@frozik/vault-app/testing/fake-session-clock';
import { CreateVaultPanel } from './CreateVaultPanel';

function aForm(): CreateVaultForm {
  return new CreateVaultForm(
    {
      estimate: () => Promise.resolve(null),
      dispose: () => undefined,
    },
    createFakeSessionClock().clock
  );
}

describe('CreateVaultPanel', () => {
  it('shows the description as it is typed', () => {
    render(<CreateVaultPanel form={aForm()} onSubmit={vi.fn()} onCancel={vi.fn()} />);
    const description = screen.getByLabelText<HTMLTextAreaElement>('Description (optional)');

    fireEvent.change(description, { target: { value: 'Shared with the kids' } });

    expect(description.value).toBe('Shared with the kids');
  });
});
