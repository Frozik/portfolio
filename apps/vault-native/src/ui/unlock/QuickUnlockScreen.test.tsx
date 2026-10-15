import type { Milliseconds } from '@frozik/utils/date/types';
import type { IKnownVault } from '@frozik/vault/persistence/ports';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { aDevice } from '@frozik/vault-app/testing/fake-device';

import { AppUnderTest } from '../testing/AppUnderTest';
import { QuickUnlockScreen } from './QuickUnlockScreen';

const VAULT: IKnownVault = {
  vaultKey: 'a1b2',
  name: 'Family',
  description: '',
  lastOpenedAt: 0 as Milliseconds,
  unsyncedChanges: false,
};

async function quickScreen(prompt: Parameters<typeof QuickUnlockScreen>[0]['prompt']) {
  const attempt = jest.fn(() => null);
  const onUseMaster = jest.fn();
  const onLockCompletely = jest.fn();
  await render(
    <AppUnderTest app={aDevice().startStore()}>
      <QuickUnlockScreen
        vault={VAULT}
        quick={{ attempt }}
        prompt={prompt}
        unlocking={false}
        onUseMaster={onUseMaster}
        onLockCompletely={onLockCompletely}
      />
    </AppUnderTest>
  );
  return { attempt, onUseMaster, onLockCompletely };
}

describe('the quick unlock screen', () => {
  it('locks completely on request, leaving no code behind', async () => {
    const { onLockCompletely } = await quickScreen({ kind: 'pin', digits: 4 });

    await fireEvent.press(screen.getByTestId('lock-completely'));

    expect(onLockCompletely).toHaveBeenCalledTimes(1);
  });

  it('offers the way back to every vault', async () => {
    await quickScreen({ kind: 'pin', digits: 4 });

    expect(screen.getByTestId('all-vaults')).toBeOnTheScreen();
  });

  it('sends the PIN the moment its last digit is in', async () => {
    const { attempt } = await quickScreen({ kind: 'pin', digits: 4 });

    for (const digit of ['1', '9', '8', '4']) {
      await fireEvent.press(screen.getByTestId(`pin-${digit}`));
    }

    expect(attempt).toHaveBeenCalledWith('1984');
  });

  it('sends the pattern a TalkBack user joined point by point', async () => {
    const { attempt } = await quickScreen({ kind: 'pattern', hideLine: false });

    for (const point of [0, 4, 8, 5]) {
      await fireEvent(screen.getByTestId(`pattern-point-${point}`), 'accessibilityAction', {
        nativeEvent: { actionName: 'activate' },
      });
    }
    await fireEvent(screen.getByTestId('pattern-pad'), 'accessibilityAction', {
      nativeEvent: { actionName: 'activate' },
    });

    expect(attempt).toHaveBeenCalledWith([0, 4, 8, 5]);
  });

  it('always offers the master password instead', async () => {
    const { onUseMaster } = await quickScreen({ kind: 'pin', digits: 6 });

    await fireEvent.press(screen.getByTestId('use-master-password'));

    expect(onUseMaster).toHaveBeenCalled();
  });
});
