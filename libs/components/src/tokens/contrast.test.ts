import type { TColorRole } from './color-roles';
import { COLOR_ROLES } from './color-roles';
import { contrastRatio } from './contrast';

const TEXT = 4.5;
const NON_TEXT = 3;

const SURFACES: readonly TColorRole[] = ['bg', 'bg-elevated', 'bg-card'];
const READ_ON_SURFACES: readonly TColorRole[] = [
  'fg',
  'fg-dim',
  'fg-faint',
  'accent',
  'danger',
  'caution',
  'positive',
];

const PAIRS: readonly (readonly [TColorRole, TColorRole, number])[] = [
  ...READ_ON_SURFACES.flatMap(text => SURFACES.map(surface => [text, surface, TEXT] as const)),
  ['on-accent', 'accent', TEXT],
  ...SURFACES.map(surface => ['focus-ring', surface, NON_TEXT] as const),
];

describe('the colour roles', () => {
  it.each(
    PAIRS.flatMap(([text, surface, minimum]) =>
      (['light', 'dark'] as const).map(scheme => [text, surface, scheme, minimum] as const)
    )
  )('keep %s on %s readable in the %s scheme (at least %d:1)', (text, surface, scheme, minimum) => {
    expect(
      contrastRatio(COLOR_ROLES[text][scheme], COLOR_ROLES[surface][scheme])
    ).toBeGreaterThanOrEqual(minimum);
  });

  it('measure black on white as 21:1 and a colour on itself as 1:1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21);
    expect(contrastRatio('#60a5fa', '#60a5fa')).toBe(1);
  });
});
