import type { TSectionEntry } from '@frozik/vault-app/document/application/section-entries';

import { vaultT } from '@frozik/vault-react/texts/vault';

/** A built-in group by its name in this language; the user's own by the name they gave it. */
export function sectionLabelOf(entry: TSectionEntry): string {
  return entry.kind === 'builtin' ? vaultT.sections[entry.section] : entry.name;
}
