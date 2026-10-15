import type { TTemplateId } from '@frozik/vault/model/ids';
import { BUILTIN_TEMPLATES } from '@frozik/vault/model/templates/registry';
import type { IUserTemplate } from '@frozik/vault/model/vault-document';

/** A template a new card can start from: a built-in one by its text key, the user's own by name. */
export type TTemplateChoice =
  | { readonly kind: 'builtin'; readonly id: TTemplateId; readonly nameKey: string }
  | { readonly kind: 'user'; readonly id: TTemplateId; readonly name: string };

/** The built-in templates in their order, then the user's own. */
export function templateChoicesOf(
  userTemplates: readonly Pick<IUserTemplate, 'id' | 'name'>[]
): readonly TTemplateChoice[] {
  return [
    ...BUILTIN_TEMPLATES.map(template => ({
      kind: 'builtin' as const,
      id: template.id,
      nameKey: template.nameKey,
    })),
    ...userTemplates.map(template => ({
      kind: 'user' as const,
      id: template.id,
      name: template.name,
    })),
  ];
}
