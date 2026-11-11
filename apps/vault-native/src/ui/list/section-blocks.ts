import type { TBuiltinGroupId } from '@frozik/vault/model/smart-groups';

import type { TSectionEntry } from '@frozik/vault-app/document/application/section-entries';

export type TSectionBlock = 'sections' | 'labels';

export const SECTION_BLOCKS: readonly TSectionBlock[] = ['sections', 'labels'];

/** What the audit finds is shown on the Audit tab, in its own groups, and not in the sheet. */
const ON_THE_AUDIT_TAB: ReadonlySet<TBuiltinGroupId> = new Set([
  'problems',
  'duplicates',
  'expiring',
  'expired',
]);

/** Where the sheet lists a section, or `null` for one the Audit tab shows instead. */
export function blockOf(entry: TSectionEntry): TSectionBlock | null {
  if (entry.kind !== 'builtin') {
    return 'labels';
  }
  return ON_THE_AUDIT_TAB.has(entry.section) ? null : 'sections';
}
