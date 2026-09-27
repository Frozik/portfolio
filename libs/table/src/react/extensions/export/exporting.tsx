import type { ITableExtension } from '../../../core/kernel/extension';
import type { IDownloadPort, IExportSlice } from '../../../extensions/export/core';
import { exporting as exportingCore } from '../../../extensions/export/core';

export function browserDownloadPort(): IDownloadPort {
  return {
    download: (filename, text, mimeType) => {
      const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
    },
  };
}

/** CSV / TSV / JSON export of all or the selected rows, downloaded through the browser unless a port is given. */
export function exporting<TRow = never>(
  options: { readonly port?: IDownloadPort } = {}
): ITableExtension<TRow, 'export', IExportSlice> {
  return exportingCore<TRow>({ port: options.port ?? browserDownloadPort() });
}
