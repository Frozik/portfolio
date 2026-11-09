import type { INumberingMask } from '../numbering/gen/numbering-codes';

/** The world's numbering catalogue: megabytes the app's start does not wait for. */
export type TLoadNumberingCatalogue = () => Promise<readonly INumberingMask[]>;
