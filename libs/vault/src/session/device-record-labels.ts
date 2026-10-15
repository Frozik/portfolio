import type { THkdfLabel } from '../crypto/hkdf';

/**
 * The subkeys this device seals its records under. A key rotation re-seals
 * each from the old key to the new one under the same label: one name each, here.
 */
export const DEVICE_CONFIG_LABEL: THkdfLabel = 'pwv/device-config';
export const DRAFT_LABEL: THkdfLabel = 'pwv/draft';
export const DEVICE_USAGE_LABEL: THkdfLabel = 'pwv/device-usage';
