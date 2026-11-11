/** A vault may be named "Work/Home": a path separator or a control character never reaches the file system. */
const UNSAFE_IN_FILE_NAME = /[/\\\p{Cc}]/gu;

export function safeFileName(name: string): string {
  return name.replace(UNSAFE_IN_FILE_NAME, '-');
}
