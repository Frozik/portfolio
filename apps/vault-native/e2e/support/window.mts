import { adb, waitFor } from '@frozik/tooling/src/android-e2e/device.ts';

export const PACKAGE = 'io.github.ciphravault.vault';

const ACTIVITY = `${PACKAGE}/${PACKAGE}.MainActivity`;
/** A window's header, then — a few lines below, among its other state — its flags. */
const WINDOW = new RegExp(
  `Window\\{(\\w+) u\\d+ ${ACTIVITY.replaceAll('.', '\\.')}\\}:[\\s\\S]*?\\bfl=([^\\n]*)`
);
/** A cold start shows its first frame within seconds; past this the app did not start. */
const FIRST_WINDOW_MS = 60_000;
/** The window flag follows the vault's state within a frame; this only bounds the wait. */
const FLAG_SETTLE_MS = 10_000;

interface IWindow {
  /** The window manager's id of this window: a new process gets a new one. */
  readonly token: string;
  readonly flags: string;
}

/** The app's main window as the window manager holds it; `null` while there is none. */
async function mainWindow(): Promise<IWindow | null> {
  const match = WINDOW.exec(await adb('shell', 'dumpsys', 'window', 'windows'));
  return match?.[1] === undefined || match[2] === undefined
    ? null
    : { token: match[1], flags: match[2] };
}

export const isSecure = (flags: string | null) => flags !== null && /\bSECURE\b/.test(flags);

/**
 * Starts the app anew and reads the flags of its new window the moment it exists. A stopped
 * process's window can linger in the window manager, so the new one is told apart by its token.
 */
export async function firstWindowFlags(): Promise<string> {
  const before = (await mainWindow())?.token ?? null;
  await adb('shell', 'am', 'force-stop', PACKAGE);
  await adb('shell', 'monkey', '-p', PACKAGE, '-c', 'android.intent.category.LAUNCHER', '1');
  const started = await waitFor(
    'the app’s new window',
    mainWindow,
    window => window !== null && window.token !== before,
    FIRST_WINDOW_MS
  );
  return started?.flags ?? '';
}

/** Waits until screenshots of the app's window are blocked (`true`) or allowed (`false`). */
export async function windowSecure(secure: boolean): Promise<void> {
  await waitFor(
    secure ? 'the window to block screenshots' : 'the window to allow screenshots',
    mainWindow,
    window => isSecure(window?.flags ?? null) === secure,
    FLAG_SETTLE_MS
  );
}
