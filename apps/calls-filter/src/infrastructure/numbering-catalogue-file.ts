import type { INumberingMask } from '../contexts/phone/domain/numbering/gen/numbering-codes';
import type { TLoadNumberingCatalogue } from '../contexts/phone/domain/ports/numbering-catalogue';

/**
 * The catalogue ships with the app as generated JSON, read on first use rather than at start.
 * JSON carries plain strings where the catalogue has codes; numbering-masks.test.ts checks every
 * entry against the generated code lists, so the shape is asserted here, not parsed again.
 */
export const loadNumberingCatalogue: TLoadNumberingCatalogue = async () => {
  const { default: roots } =
    await import('../contexts/phone/domain/numbering/gen/numbering-masks.json');
  return roots as readonly INumberingMask[];
};
