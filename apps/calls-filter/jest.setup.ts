import { configure } from '@testing-library/react-native';

/** Waits end the moment the event happens; the margin is for a loaded CI runner, never a budget. */
const EVENT_WAIT_MS = 10_000;

configure({ asyncUtilTimeout: EVENT_WAIT_MS });

// Reanimated runs on worklets' native runtime; jest has none, so the libraries' own stand-ins.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// The dialog is Android's own; a screen test only opens screens that may show it.
jest.mock('@react-native-community/datetimepicker', () => ({
  DateTimePickerAndroid: { open: jest.fn(), dismiss: jest.fn() },
}));
