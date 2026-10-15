import type { TColorRole } from './color-roles';
import { COLOR_ROLES, LANDING_ALIASES } from './color-roles';

const SCHEMES = { light: 'light', dark: 'dark', system: 'light dark' } as const;

function declarations(indent: string): string {
  const roles = Object.entries(COLOR_ROLES).map(
    ([role, { light, dark }]) => `${indent}--color-${role}: light-dark(${light}, ${dark});`
  );
  const aliases = Object.entries(LANDING_ALIASES).map(
    ([alias, role]: [string, TColorRole]) => `${indent}--color-${alias}: var(--color-${role});`
  );
  return [...roles, ...aliases].join('\n');
}

/**
 * The Tailwind theme of the colour roles. Every `[data-theme]` element
 * declares the palette again: a build that lowers `light-dark()` resolves it
 * where the variable is declared, so a nested scheme needs its own copy.
 */
export function themeCss(): string {
  const schemes = Object.entries(SCHEMES).map(
    ([theme, scheme]) => `[data-theme='${theme}'] {\n  color-scheme: ${scheme};\n}`
  );
  return `${[
    '/* Generated from src/tokens/color-roles.ts by `pnpm --filter @frozik/components run generate-theme`. */',
    `@theme static {\n${declarations('  ')}\n}`,
    `[data-theme] {\n${declarations('  ')}\n}`,
    ...schemes,
  ].join('\n\n')}\n`;
}
