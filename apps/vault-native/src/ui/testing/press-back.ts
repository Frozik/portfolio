import { act } from 'expo-router/testing-library';
import { DeviceEventEmitter } from 'react-native';

/** The phone's back — its button or the edge gesture — as Android hands it to the app. */
export async function pressBack(): Promise<void> {
  await act(async () => {
    DeviceEventEmitter.emit('hardwareBackPress');
    await Promise.resolve();
  });
}
