import type { NetworkStateEvent } from 'expo-network';
import { addNetworkStateListener } from 'expo-network';
import type { AppStateStatus } from 'react-native';
import { AppState } from 'react-native';

import { createNativeLockSignals } from './app-state-lock-signals';

jest.mock('expo-network', () => ({ addNetworkStateListener: jest.fn() }));

function capturedAppStateListener(): (state: AppStateStatus) => void {
  let captured: (state: AppStateStatus) => void = () => undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    captured = listener;
    return { remove: jest.fn() };
  });
  return state => captured(state);
}

function capturedNetworkListener(): (event: NetworkStateEvent) => void {
  let captured: (event: NetworkStateEvent) => void = () => undefined;
  jest.mocked(addNetworkStateListener).mockImplementation(listener => {
    captured = listener;
    return { remove: jest.fn() };
  });
  return event => captured(event);
}

describe('the phone’s lock signals', () => {
  it('report the app concealed in the background and shown when active again', () => {
    const changeAppState = capturedAppStateListener();
    const { signals } = createNativeLockSignals();
    const concealed: boolean[] = [];

    signals.onConcealed(hidden => concealed.push(hidden));
    changeAppState('background');
    changeAppState('active');

    expect(concealed).toEqual([true, false]);
  });

  it('report the network back only after it was lost', () => {
    const changeNetwork = capturedNetworkListener();
    const { signals } = createNativeLockSignals();
    const online = jest.fn();

    signals.onOnline(online);
    changeNetwork({ isInternetReachable: true });
    changeNetwork({ isInternetReachable: false });
    changeNetwork({ isInternetReachable: true });

    expect(online).toHaveBeenCalledTimes(1);
  });

  it('pass the root view’s touches to each subscriber until it unsubscribes', () => {
    const { signals, reportActivity } = createNativeLockSignals();
    const activity = jest.fn();

    const stop = signals.onActivity(activity);
    reportActivity();
    stop();
    reportActivity();

    expect(activity).toHaveBeenCalledTimes(1);
  });
});
