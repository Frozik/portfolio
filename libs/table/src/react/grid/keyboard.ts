import type { KeyboardEvent } from 'react';

const MODIFIERS = new Set(['Ctrl', 'Meta', 'Mod', 'Shift', 'Alt']);

/**
 * Whether a binding such as `Shift+ArrowLeft` or `Mod+C` describes the event.
 * `Mod` is the platform command key: Meta on macOS, Ctrl elsewhere. A single
 * character matches regardless of case, since Shift changes what `key` reports.
 */
export function matchesKey(
  binding: string,
  event: KeyboardEvent | globalThis.KeyboardEvent
): boolean {
  const parts = binding.split('+');
  const key = parts[parts.length - 1];
  const modifiers = new Set(parts.slice(0, -1));
  for (const modifier of modifiers) {
    if (!MODIFIERS.has(modifier)) {
      return false;
    }
  }
  const mod = event.metaKey || event.ctrlKey;
  const sameKey =
    key.length === 1 ? event.key.toLowerCase() === key.toLowerCase() : event.key === key;
  return (
    sameKey &&
    event.shiftKey === modifiers.has('Shift') &&
    event.altKey === modifiers.has('Alt') &&
    (modifiers.has('Mod')
      ? mod
      : event.ctrlKey === modifiers.has('Ctrl') && event.metaKey === modifiers.has('Meta'))
  );
}
