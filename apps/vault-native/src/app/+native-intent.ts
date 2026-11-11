const FILE_LINK = /^(content|file):/i;

/** A file another app hands over is not a page: the app takes it in as a vault file instead. */
export function redirectSystemPath({
  path,
}: {
  readonly path: string;
  readonly initial: boolean;
}): string | null {
  return FILE_LINK.test(path) ? null : path;
}
