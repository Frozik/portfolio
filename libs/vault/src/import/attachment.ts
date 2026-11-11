const FALLBACK_MIME = 'application/octet-stream';
const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  txt: 'text/plain',
};

/** An attachment's type from its name; one this table does not know is plain bytes. */
export function mimeOfFileName(name: string): string {
  const extension = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
  return MIME_BY_EXTENSION[extension] ?? FALLBACK_MIME;
}
