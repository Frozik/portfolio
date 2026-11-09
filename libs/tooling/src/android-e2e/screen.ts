import { adb, waitFor } from './device.ts';

/** A screen shows within seconds; an element missing past this is a failure, not slowness. */
const ELEMENT_TIMEOUT_MS = 30_000;
/** More swipes than this and the element is not on this screen at all. */
const MAX_SWIPES = 8;
const SWIPE_MS = 250;
const SWIPE_FROM = 0.7;
const SWIPE_TO = 0.35;
/** `input text` takes these as they are; anything else would need the device shell's quoting. */
const TYPABLE = /^[\w@.,:+=-]+( [\w@.,:+=-]+)*$/;

/** Where an element is on screen, in pixels; `whole` when none of it is cut off. */
export interface IPlace {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly whole: boolean;
  /** A disabled button is on screen but not yet for tapping. */
  readonly enabled: boolean;
}

/** Finds an element by its `testID` (or Android resource id); `null` while it is not on screen. */
export type TLocate = (id: string) => Promise<IPlace | null>;

const NODE = /<node\b[^>]*>/g;
const BOUNDS = /\[(\d+),(\d+)\]\[(\d+),(\d+)\]/;

function attribute(node: string, name: string): string {
  return new RegExp(`\\b${name}="([^"]*)"`).exec(node)?.[1] ?? '';
}

/**
 * Any app's element, from the view tree `uiautomator` reports. It costs about two seconds
 * whatever the screen — the tool starts anew each time — and a failed read (a screen that never
 * goes idle, as under a spinner) is a screen with nothing on it yet. An app with an e2e channel
 * answers in milliseconds instead (see the README).
 */
export const locateByDump: TLocate = async id => {
  const xml = await adb('exec-out', 'uiautomator', 'dump', '/dev/tty').catch(() => '');
  let height = 0;
  let found: Omit<IPlace, 'whole'> | null = null;
  for (const [node] of xml.matchAll(NODE)) {
    const bounds = BOUNDS.exec(attribute(node, 'bounds'));
    if (bounds === null) {
      continue;
    }
    const [left, top, right, bottom] = bounds.slice(1).map(Number) as [
      number,
      number,
      number,
      number,
    ];
    height = Math.max(height, bottom);
    if (found === null && attribute(node, 'resource-id') === id) {
      found = { left, top, right, bottom, enabled: attribute(node, 'enabled') === 'true' };
    }
  }
  return found === null ? null : { ...found, whole: found.top >= 0 && found.bottom < height };
};

async function screenHeight(): Promise<number> {
  const sizes = await adb('shell', 'wm', 'size');
  const size = /Override size: \d+x(\d+)/.exec(sizes) ?? /Physical size: \d+x(\d+)/.exec(sizes);
  return Number(size?.[1] ?? 0);
}

async function keyboardShown(): Promise<boolean> {
  return /mInputShown=true/.test(await adb('shell', 'dumpsys', 'input_method'));
}

/** Closes the keyboard if it is open; «back» with no keyboard would leave the screen instead. */
export async function hideKeyboard(): Promise<void> {
  if (await keyboardShown()) {
    await adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
    await waitFor('the keyboard to close', keyboardShown, shown => !shown, ELEMENT_TIMEOUT_MS);
  }
}

/** Types into the focused field at once: a tenth of a second for a whole password. */
async function typeText(text: string): Promise<void> {
  if (!TYPABLE.test(text)) {
    throw new Error(
      `«${text}» has characters the device shell would read: keep tests to [\\w@.,:+=-] and spaces`
    );
  }
  await adb('shell', 'input', 'text', text.replaceAll(' ', '%s'));
}

/**
 * Driving a screen over `adb`: taps by `testID`, typing at once, scrolling by swipes. Where the
 * elements are comes from `locate` — the screen dump by default, an app's own channel when it has one.
 */
export function screenDriver(
  locate: TLocate = locateByDump,
  /** `uiautomator` reports a screen only once it is idle, so one of its reads is already settled. */
  readsAreSettled = locate === locateByDump
) {
  async function waitForElement(id: string, timeoutMs = ELEMENT_TIMEOUT_MS): Promise<IPlace> {
    const place = await waitFor(
      `«${id}» on screen`,
      () => locate(id),
      found => found !== null,
      timeoutMs
    );
    if (place === null) {
      throw new Error(`«${id}» vanished`);
    }
    return place;
  }

  /**
   * Taps the middle of an element once it can take the tap: on screen, enabled, and no longer
   * moving — a sheet sliding in reports where it is mid-way, and a tap there lands beside it.
   */
  async function tap(id: string): Promise<void> {
    let previous: IPlace | null = null;
    const place = await waitFor(
      `«${id}» to take a tap`,
      () => locate(id),
      found => {
        const still =
          readsAreSettled ||
          (previous !== null &&
            found !== null &&
            found.top === previous.top &&
            found.left === previous.left);
        const settled = found !== null && found.enabled && still;
        previous = found;
        return settled;
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

  return {
    waitForElement,
    tap,

    /** Waits until no element has this id: a sheet closed, a screen left. */
    async waitForAbsent(id: string, timeoutMs = ELEMENT_TIMEOUT_MS): Promise<void> {
      await waitFor(
        `«${id}» to leave the screen`,
        () => locate(id),
        found => found === null,
        timeoutMs
      );
    },

    /** Taps a field and types into it. */
    async fill(id: string, text: string): Promise<void> {
      await tap(id);
      await typeText(text);
    },

    /** Swipes the screen's content up until the element is wholly on screen. */
    async scrollIntoView(id: string): Promise<IPlace> {
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
    },
  };
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
