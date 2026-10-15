import { configure } from '@testing-library/react-native';

/** Waits end the moment the event happens; the margin is for a loaded CI runner, never a budget. */
const EVENT_WAIT_MS = 10_000;

configure({ asyncUtilTimeout: EVENT_WAIT_MS });
