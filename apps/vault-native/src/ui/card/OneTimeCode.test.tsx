import { aCardWith, aField } from '@frozik/vault/testing/builders';
import { fireEvent, screen } from 'expo-router/testing-library';

import { unlockedVaultWith } from '../testing/unlocked-vault';

const TOTP_PERIOD_SECONDS = 30;
const GITHUB = aCardWith(
  [aField({ kind: 'otp' }, 'otpauth://totp/GitHub:jane?secret=JBSWY3DPEHPK3PXP&issuer=GitHub')],
  { title: 'GitHub' }
);

describe('a time-based one-time code', () => {
  it('shows the time its code has left as a ring over the code’s period', async () => {
    await unlockedVaultWith([GITHUB]);
    await fireEvent.press(screen.getByTestId('card-row'));

    const ring = await screen.findByTestId('code-countdown');

    const { min, max, now } = ring.props.accessibilityValue;
    expect({ min, max, inPeriod: now >= 0 && now <= TOTP_PERIOD_SECONDS }).toEqual({
      min: 0,
      max: TOTP_PERIOD_SECONDS,
      inPeriod: true,
    });
  });
});
