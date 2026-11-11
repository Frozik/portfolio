import { fireEvent, screen } from 'expo-router/testing-library';

/** Every row on screen begins a swipe, as a finger would: their actions are drawn only then. */
export async function startSwipes(): Promise<void> {
  for (const row of screen.queryAllByTestId('swipe-row')) {
    await fireEvent(row, 'swipeableOpenStartDrag');
  }
}
