import { whyAppDied } from './app-death.ts';

const PACKAGE = 'io.github.frozik.callsfilter';

const STARTED = `11-09 20:58:40.120   521   549 I ActivityManager: Start proc 4366:${PACKAGE}/u0a192 for next-top-activity {${PACKAGE}/${PACKAGE}.MainActivity}`;
const PLAY_SERVICES_TOOK_IT_DOWN = `11-09 20:59:12.601   521  2517 I ActivityManager: Killing 4366:${PACKAGE}/u0a192 (adj 0): depends on provider com.google.android.gms/.fonts.provider.FontsProvider in dying proc com.google.android.gms.persistent (adj 0)`;
const FORCE_STOPPED = `11-10 00:31:02.101   521   821 I ActivityManager: Killing 23540:${PACKAGE}/u0a192 (adj 0): stop ${PACKAGE} due to from pid 23540`;
const LOW_MEMORY = `11-09 20:59:12.601   180   180 I lowmemorykiller: Kill '${PACKAGE}' (4366), uid 10192, oom_score_adj 900 to free 98000kB rss`;
const CRASHED = [
  '11-09 20:59:12.590  4366  4366 E AndroidRuntime: FATAL EXCEPTION: main',
  `11-09 20:59:12.590  4366  4366 E AndroidRuntime: Process: ${PACKAGE}, PID: 4366`,
  '11-09 20:59:12.590  4366  4366 E AndroidRuntime: java.lang.IllegalStateException: broken',
].join('\n');
const NOT_RESPONDING = `11-09 20:59:12.590   521  6110 E ActivityManager: ANR in ${PACKAGE} (${PACKAGE}/.MainActivity)`;
const OTHER_APP_CRASHED = [
  '11-09 20:59:12.590  1452  1452 E AndroidRuntime: FATAL EXCEPTION: main',
  '11-09 20:59:12.590  1452  1452 E AndroidRuntime: Process: com.google.android.gms, PID: 1452',
].join('\n');

const logcat = (...lines: readonly string[]) => lines.join('\n');

describe('why the app is gone, as logcat tells it', () => {
  it('says the system took it down with Play services, and why', () => {
    expect(whyAppDied(logcat(STARTED, PLAY_SERVICES_TOOK_IT_DOWN), PACKAGE)).toEqual({
      kind: 'killed-by-system',
      reason:
        'depends on provider com.google.android.gms/.fonts.provider.FontsProvider in dying proc com.google.android.gms.persistent (adj 0)',
    });
  });

  it('says the system freed memory by it', () => {
    expect(whyAppDied(logcat(STARTED, LOW_MEMORY), PACKAGE).kind).toBe('killed-by-system');
  });

  it('tells a forced stop from the system taking the app down: nothing to start again after', () => {
    expect(whyAppDied(logcat(STARTED, FORCE_STOPPED), PACKAGE)).toEqual({
      kind: 'stopped',
      reason: `stop ${PACKAGE} due to from pid 23540`,
    });
  });

  it('goes by the last kill since the start: the one that ended the process', () => {
    expect(
      whyAppDied(logcat(STARTED, FORCE_STOPPED, PLAY_SERVICES_TOOK_IT_DOWN), PACKAGE).kind
    ).toBe('killed-by-system');
  });

  it('says the app crashed on an exception of its own, even when the system then killed it', () => {
    expect(whyAppDied(logcat(STARTED, CRASHED, PLAY_SERVICES_TOOK_IT_DOWN), PACKAGE).kind).toBe(
      'crashed'
    );
  });

  it('says the app crashed when it stopped responding', () => {
    expect(whyAppDied(logcat(STARTED, NOT_RESPONDING), PACKAGE).kind).toBe('crashed');
  });

  it('reads only what happened since the app last started', () => {
    expect(whyAppDied(logcat(CRASHED, STARTED, PLAY_SERVICES_TOOK_IT_DOWN), PACKAGE).kind).toBe(
      'killed-by-system'
    );
  });

  it('pays no attention to another app’s crash', () => {
    expect(whyAppDied(logcat(STARTED, OTHER_APP_CRASHED), PACKAGE).kind).toBe('unknown');
  });

  it('knows nothing when logcat says nothing of the app’s end', () => {
    expect(whyAppDied(logcat(STARTED), PACKAGE).kind).toBe('unknown');
  });
});
