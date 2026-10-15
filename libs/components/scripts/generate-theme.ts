/**
 * Writes `src/tokens/theme.css` from the colour roles; with `--check` only
 * fails when the committed file is out of date.
 */
import { readFileSync, writeFileSync } from 'node:fs';

import { themeCss } from '../src/tokens/theme-css';

const THEME = new URL('../src/tokens/theme.css', import.meta.url);

if (process.argv.includes('--check')) {
  if (readFileSync(THEME, 'utf8') !== themeCss()) {
    console.error('theme.css is out of date: pnpm --filter @frozik/components run generate-theme');
    process.exit(1);
  }
} else {
  writeFileSync(THEME, themeCss());
}
