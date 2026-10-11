const APPLE_PLATFORM = /Mac|iPhone|iPad/;

/** A shortcut as the keyboard in front of the user writes it: ⌘ on Apple devices, Ctrl elsewhere. */
export function shortcutLabel(key: string): string {
  return APPLE_PLATFORM.test(navigator.userAgent) ? `⌘${key}` : `Ctrl+${key}`;
}
