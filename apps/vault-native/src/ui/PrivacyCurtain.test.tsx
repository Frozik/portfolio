import { act, render, screen } from '@testing-library/react-native';
import type { AppStateStatus } from 'react-native';
import { AppState } from 'react-native';

import { aDevice } from '@frozik/vault-app/testing/fake-device';

import { PrivacyCurtain } from './PrivacyCurtain';
import { AppUnderTest } from './testing/AppUnderTest';

describe('the privacy curtain', () => {
  it('covers the screen while the app is in the background and lifts when it is back', async () => {
    let changed = (): void => undefined;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      changed = () => listener(AppState.currentState);
      return { remove: jest.fn() };
    });
    const switchTo = (next: AppStateStatus): void => {
      Object.defineProperty(AppState, 'currentState', { value: next, configurable: true });
      changed();
    };
    switchTo('active');
    await render(
      <AppUnderTest app={aDevice().startStore()}>
        <PrivacyCurtain />
      </AppUnderTest>
    );

    await act(() => switchTo('background'));
    const coveredAway = screen.queryByTestId('privacy-curtain') !== null;
    await act(() => switchTo('active'));

    expect([coveredAway, screen.queryByTestId('privacy-curtain') !== null]).toEqual([true, false]);
  });
});
