import { when } from 'mobx';

import type { IStrengthMeter } from '../../audit/domain/ports/strength-meter';
import { createFakeSessionClock } from '../../testing/fake-session-clock';
import type { IPasswordStrength } from '../domain/master-password';
import { CreateVaultForm, STRENGTH_DEBOUNCE_MS } from './CreateVaultForm';

const STRONG = 'tundra velvet orbit cactus';

function aForm() {
  const asked: { password: string; userInputs: readonly string[] }[] = [];
  const meter: IStrengthMeter = {
    estimate: (password, userInputs) => {
      asked.push({ password, userInputs });
      const verdict: IPasswordStrength = {
        score: password.length > 20 ? 4 : 1,
        offlineCrackTime: 'centuries',
        warning: null,
        suggestions: [],
      };
      return Promise.resolve(verdict);
    },
    dispose: () => undefined,
  };
  const time = createFakeSessionClock();
  return { form: new CreateVaultForm(meter, time.clock), asked, ...time };
}

describe('CreateVaultForm', () => {
  it('asks the meter once typing pauses, with the vault name as a word to avoid', async () => {
    const { form, asked, advance } = aForm();
    form.setName('Home');

    form.setPassword('tundra');
    form.setPassword(STRONG);
    advance(STRENGTH_DEBOUNCE_MS);
    await when(() => form.strength !== null);

    expect(asked).toEqual([{ password: STRONG, userInputs: ['Home'] }]);
    expect(form.strength?.score).toBe(4);
  });

  it('names what still blocks creating, and hands the password over only once it is all fine', () => {
    const { form } = aForm();

    expect(form.problem).toBe('no-name');
    form.setName('Home');
    form.setPassword(STRONG);
    form.setConfirmation(STRONG);
    expect(form.take()).toBeNull();
    form.setAcknowledged(true);

    expect(form.take()).toEqual({ name: 'Home', description: '', password: STRONG });
    expect(form.password).toBe('');
    expect(form.confirmation).toBe('');
  });

  it('hands over an optional description with the name, trimmed', () => {
    const { form } = aForm();
    form.setName('Home');
    form.setDescription('  Shared with the kids \n');
    form.setPassword(STRONG);
    form.setConfirmation(STRONG);
    form.setAcknowledged(true);

    expect(form.take()).toMatchObject({ name: 'Home', description: 'Shared with the kids' });
  });
});
