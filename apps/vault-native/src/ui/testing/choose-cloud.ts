import { fireEvent, screen } from 'expo-router/testing-library';

/** Picks a storage from the cloud list by its value: `drive:app-data`, `drive:my-drive`, `webdav:<preset>`, `webdav-custom`. */
export async function chooseCloud(value: string): Promise<void> {
  await fireEvent.press(await screen.findByTestId('cloud-choice'));
  await fireEvent.press(await screen.findByTestId(`cloud-choice-${value}`));
}
