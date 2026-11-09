import type { IPlace } from './agent.ts';
import { locate, setText } from './agent.ts';
import { adb, waitFor } from './device.ts';

/** A screen shows within seconds; an element missing past this is a failure, not slowness. */
const ELEMENT_TIMEOUT_MS = 30_000;
/** More swipes than this and the element is not on this screen at all. */
const MAX_SWIPES = 8;
const SWIPE_MS = 250;
const SWIPE_FROM = 0.7;
const SWIPE_TO = 0.35;

/** What a test waits to see of an element besides its being on screen. */
type TExpected = Partial<Pick<IPlace, 'enabled' | 'checked'>>;

const shows = (place: IPlace, expected: TExpected) =>
  (expected.enabled === undefined || place.enabled === expected.enabled) &&
  (expected.checked === undefined || place.checked === expected.checked);

/**
 * Waits for an element by its `testID` (or another app's full resource id), and for the state a
 * test expects of it — a switch turned on is the sign a tap took effect, not a pause after it.
 */
export async function waitForElement(
  id: string,
  { timeoutMs = ELEMENT_TIMEOUT_MS, ...expected }: TExpected & { readonly timeoutMs?: number } = {}
): Promise<IPlace> {
  const place = await waitFor(
    `«${id}» on screen${Object.keys(expected).length === 0 ? '' : ` as ${JSON.stringify(expected)}`}`,
    () => locate(id),
    found => found !== null && shows(found, expected),
    timeoutMs
  );
  if (place === null) {
    throw new Error(`«${id}» vanished`);
  }
  return place;
}

/** Waits until no element has this id: a sheet closed, a screen left. */
export async function waitForAbsent(id: string, timeoutMs = ELEMENT_TIMEOUT_MS): Promise<void> {
  await waitFor(
    `«${id}» to leave the screen`,
    () => locate(id),
    found => found === null,
    timeoutMs
  );
}

/**
 * Taps the middle of an element once it can take the tap: on screen, enabled, and no longer
 * moving — a sheet sliding in reports where it is mid-way, and a tap there lands beside it.
 */
export async function tap(id: string): Promise<void> {
  let previous: IPlace | null = null;
  const place = await waitFor(
    `«${id}» to take a tap`,
    () => locate(id),
    found => {
      const still =
        previous !== null &&
        found !== null &&
        found.top === previous.top &&
        found.left === previous.left;
      previous = found;
      return found !== null && found.enabled && still;
    },
    ELEMENT_TIMEOUT_MS
  );
  if (place === null) {
    throw new Error(`«${id}» vanished`);
  }
  const x = Math.round((place.left + place.right) / 2);
  const y = Math.round((place.top + place.bottom) / 2);
  await adb('shell', 'input', 'tap', String(x), String(y));
}

/** A system dialog that ignored a tap has had enough time by now to show it was ignored. */
const TAP_EFFECT_MS = 2_000;
const TAP_ATTEMPTS = 3;

/**
 * Taps an element until it leaves the screen. Android's own dialogs (permissions) ignore touches
 * while they appear — a guard against taps slipped under them — however settled they look; the
 * tap's effect, the dialog gone, is what tells it landed.
 */
export async function tapUntilGone(id: string): Promise<void> {
  for (let attempt = 1; attempt <= TAP_ATTEMPTS; attempt++) {
    await tap(id);
    const gone = await waitForAbsent(id, TAP_EFFECT_MS).then(
      () => true,
      () => false
    );
    if (gone) {
      return;
    }
  }
  throw new Error(`«${id}» stayed on screen after ${TAP_ATTEMPTS} taps`);
}

/** Puts text into a field as the user's typing would end up: all at once, no keyboard. */
export async function fill(id: string, text: string): Promise<void> {
  await waitForElement(id);
  await setText(id, text);
}

async function screenHeight(): Promise<number> {
  const sizes = await adb('shell', 'wm', 'size');
  const size = /Override size: \d+x(\d+)/.exec(sizes) ?? /Physical size: \d+x(\d+)/.exec(sizes);
  return Number(size?.[1] ?? 0);
}

/** Swipes the screen's content up until the element is wholly on screen. */
export async function scrollIntoView(id: string): Promise<IPlace> {
  const height = await screenHeight();
  const x = String(Math.round(height / 4));
  for (let swipe = 0; swipe <= MAX_SWIPES; swipe++) {
    const place = await locate(id);
    if (place?.whole === true) {
      return place;
    }
    await adb(
      'shell',
      'input',
      'swipe',
      x,
      String(Math.round(height * SWIPE_FROM)),
      x,
      String(Math.round(height * SWIPE_TO)),
      String(SWIPE_MS)
    );
  }
  throw new Error(`«${id}» not found after ${MAX_SWIPES} swipes`);
}

/** Opens a link the app handles, as tapping it elsewhere would. */
export async function openLink(url: string, packageName: string): Promise<void> {
  await adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', url, packageName);
}

/** Starts the app from its launcher icon. */
export async function launch(packageName: string): Promise<void> {
  await adb('shell', 'monkey', '-p', packageName, '-c', 'android.intent.category.LAUNCHER', '1');
}

/** Wipes the app's data and starts it, as a fresh install would. */
export async function launchClean(packageName: string): Promise<void> {
  await adb('shell', 'pm', 'clear', packageName);
  await launch(packageName);
}
