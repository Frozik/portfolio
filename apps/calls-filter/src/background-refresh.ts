import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { startApp } from './composition-root';
import { NATIVE_DIAGNOSTICS_LOG } from './infrastructure/native-diagnostics-log';

const TASK_NAME = 'calls-filter-refresh';
/** Calendars and iCal links are re-read about twice a day; Android may stretch it further. */
const REFRESH_INTERVAL_MINUTES = 12 * 60;

TaskManager.defineTask(TASK_NAME, async () => {
  try {
    const app = await startApp();
    await app.refreshInBackground();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error: unknown) {
    NATIVE_DIAGNOSTICS_LOG.log('error', 'background', 'refresh-failed', { error: String(error) });
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

/** Asks Android to wake the app now and then, so rules stay fresh while it is never opened. */
async function scheduleBackgroundRefresh(): Promise<void> {
  if (await TaskManager.isTaskRegisteredAsync(TASK_NAME)) {
    return;
  }
  await BackgroundTask.registerTaskAsync(TASK_NAME, { minimumInterval: REFRESH_INTERVAL_MINUTES });
}

scheduleBackgroundRefresh().catch((error: unknown) => {
  NATIVE_DIAGNOSTICS_LOG.log('warn', 'background', 'schedule-failed', { error: String(error) });
});
