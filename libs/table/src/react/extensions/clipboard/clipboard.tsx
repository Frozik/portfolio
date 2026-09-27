import type { ITableExtension } from '../../../core/kernel/extension';
import type { IClipboardPort, IClipboardSlice } from '../../../extensions/clipboard/core';
import { clipboard as clipboardCore } from '../../../extensions/clipboard/core';

export function navigatorClipboardPort(): IClipboardPort {
  return { write: text => navigator.clipboard.writeText(text) };
}

/** Ctrl/⌘+C copies what is selected, Ctrl/⌘+Shift+C the focused cell; the browser clipboard unless a port is given. */
export function clipboard<TRow = never>(
  options: { readonly port?: IClipboardPort } = {}
): ITableExtension<TRow, 'clipboard', IClipboardSlice> {
  return clipboardCore<TRow>({ port: options.port ?? navigatorClipboardPort() });
}
