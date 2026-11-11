import { when } from 'mobx';

import { createFakeSessionClock } from '../../testing/fake-session-clock';
import type { IPasswordStrength } from '../domain/master-password';
import { CreateVaultForm, STRENGTH_DEBOUNCE_MS } from './CreateVaultForm';

const STRONG_FROM_LENGTH = 20;

function aForm() {
  const time = createFakeSessionClock();
  const form = new CreateVaultForm(
    {
      id: 'by-length',
      estimate: password =>
        Promise.resolve<IPasswordStrength>({
          score: password.length < STRONG_FROM_LENGTH ? 1 : 4,
          offlineCrackTime: '',
          warning: null,
          suggestions: [],
        }),
      dispose: () => undefined,
    },
    time.clock
  );
  const typed = async (password: string) => {
    form.setPassword(password);
    time.advance(STRENGTH_DEBOUNCE_MS);
    await when(() => form.strength !== null);
  };
  return { form, typed };
}

describe('the new vault’s password', () => {
  it('takes even one character, and says what a weak one lacks', async () => {
    const { form, typed } = aForm();
    form.setName('Home');
    form.setAcknowledged(true);

    await typed('a');
    form.setConfirmation('a');

    expect({ problem: form.problem, advice: form.advice }).toEqual({
      problem: null,
      advice: ['longer', 'digits', 'capitals', 'symbols'],
    });
  });

  it('gives no advice once the meter calls the password strong', async () => {
    const { form, typed } = aForm();

    await typed('plain lowercase words only');

    expect(form.advice).toEqual([]);
  });
});
