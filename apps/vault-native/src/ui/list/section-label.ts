import type { TSectionEntry } from '@frozik/vault-app/document/application/section-entries';
import type { TVaultTexts } from '@frozik/vault-app/texts/vault/vault-texts';

/** A built-in group by its name in this language; the user's own by the name they gave it. */
export function sectionLabelOf(t: TVaultTexts, entry: TSectionEntry): string {
  return entry.kind === 'builtin' ? t.sections[entry.section] : entry.name;
}
