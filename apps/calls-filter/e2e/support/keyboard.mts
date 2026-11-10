import { adb, waitFor } from '@frozik/tooling/src/android-e2e/device.ts';

/** The keyboard slides in over a few hundred milliseconds; one shown this late is not coming. */
const KEYBOARD_SHOWN_MS = 15_000;

interface IKeyboard {
  readonly top: number;
  readonly bottom: number;
  readonly visible: boolean;
}

async function keyboard(): Promise<IKeyboard | null> {
  const windows = await adb('shell', 'dumpsys', 'window');
  const source = /type=ime frame=\[\d+,(\d+)\]\[\d+,(\d+)\][^\n]*visible=(\w+)/.exec(windows);
  return source === null
    ? null
    : { top: Number(source[1]), bottom: Number(source[2]), visible: source[3] === 'true' };
}

/**
 * A phone with a physical keyboard — an emulator taking the Mac's — shows only a toolbar for
 * typing, so nothing on screen has a keyboard to rise above.
 */
export async function hasPhysicalKeyboard(): Promise<boolean> {
  const windows = await adb('shell', 'dumpsys', 'window');
  return /mGlobalConfiguration=\{[^}]* qwerty\//.test(windows);
}

/**
 * Where the on-screen keyboard's top edge settles, in pixels from the top of the screen. It
 * counts as settled once two reads in a row agree, so a keyboard still sliding in is never measured.
 */
export async function keyboardTop(): Promise<number> {
  let previous: number | null = null;
  const settled = await waitFor(
    'the keyboard to settle on screen',
    keyboard,
    shown => {
      const height = shown === null || !shown.visible ? 0 : shown.bottom - shown.top;
      const still = height > 0 && shown?.top === previous;
      previous = shown?.top ?? null;
      return still;
    },
    KEYBOARD_SHOWN_MS
  );
  if (settled === null) {
    throw new Error('The keyboard vanished');
  }
  return settled.top;
}

export async function hideKeyboard(): Promise<void> {
  if ((await keyboard())?.visible === true) {
    await adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
  }
}
