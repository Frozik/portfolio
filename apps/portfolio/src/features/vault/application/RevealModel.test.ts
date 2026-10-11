import type { TFieldId } from '@frozik/vault/model/ids';

import { createFakePageSignals } from './fake-page-signals.test-helper';
import { createFakeSessionClock } from './fake-session-clock.test-helper';
import { REVEAL_FOR_MS, RevealModel } from './RevealModel';

const PASSWORD = 'password-field' as TFieldId;
const CVV = 'cvv-field' as TFieldId;

function reveal() {
  const time = createFakeSessionClock();
  const page = createFakePageSignals();
  return { ...time, ...page, model: new RevealModel(time.clock, page.page) };
}

describe('RevealModel', () => {
  it('hides a shown secret again after thirty seconds, each on its own count', () => {
    const setup = reveal();

    setup.model.toggle(PASSWORD);
    setup.advance(REVEAL_FOR_MS / 2);
    setup.model.toggle(CVV);
    setup.advance(REVEAL_FOR_MS / 2);

    expect(setup.model.isRevealed(PASSWORD)).toBe(false);
    expect(setup.model.isRevealed(CVV)).toBe(true);
  });

  it('hides a secret on the second press and forgets its timer', () => {
    const setup = reveal();

    setup.model.toggle(PASSWORD);
    setup.model.toggle(PASSWORD);

    expect(setup.model.isRevealed(PASSWORD)).toBe(false);
    expect(setup.pendingTimers()).toBe(0);
  });

  it('hides everything when the tab is hidden', () => {
    const setup = reveal();

    setup.model.toggle(PASSWORD);
    setup.model.toggle(CVV);
    setup.setHidden(true);

    expect(setup.model.revealed.size).toBe(0);
  });

  it('shows one value of a list on its own, the others staying masked', () => {
    const setup = reveal();

    setup.model.toggle(PASSWORD, 1);

    expect(setup.model.isRevealed(PASSWORD, 1)).toBe(true);
    expect(setup.model.isRevealed(PASSWORD, 0)).toBe(false);
    expect(setup.model.isRevealed(PASSWORD, 2)).toBe(false);
  });
});
