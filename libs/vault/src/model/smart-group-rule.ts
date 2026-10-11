import type { TFieldKind } from './card';
import type { TGroupId, TTemplateId } from './ids';

/** A group whose members a rule computes; nothing about membership is stored. */
export type TSmartGroupRule =
  | { readonly kind: 'expiry'; readonly status: 'soon' | 'expired' }
  | { readonly kind: 'template'; readonly templateIds: readonly TTemplateId[] }
  | { readonly kind: 'has-field'; readonly fieldKind: TFieldKind; readonly value?: string }
  | { readonly kind: 'in-group'; readonly groupId: TGroupId }
  | { readonly kind: 'favorite' }
  | { readonly kind: 'trashed' }
  | { readonly kind: 'archived' }
  | { readonly kind: 'protected' }
  | { readonly kind: 'no-group' }
  /** The audit found something about the card. */
  | { readonly kind: 'audit-problem' }
  /** Another card signs in to the same site with the same login. */
  | { readonly kind: 'possible-duplicate' }
  | { readonly kind: 'all' | 'any'; readonly rules: readonly TSmartGroupRule[] }
  | { readonly kind: 'not'; readonly rule: TSmartGroupRule };
