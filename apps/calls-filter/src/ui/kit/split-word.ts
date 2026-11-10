/** Whether a laid-out text broke a word across two lines: every line but the last ends in a space or a dash. */
export function splitsWord(lines: readonly { readonly text: string }[]): boolean {
  return lines.slice(0, -1).some(line => !/[\s\-–—]$/u.test(line.text));
}
