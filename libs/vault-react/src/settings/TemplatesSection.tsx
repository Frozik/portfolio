import type { IUserTemplate } from '@frozik/vault/model/vault-document';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';

import { Button } from '@frozik/components/ui/Button';
import { CardFrame } from '@frozik/components/ui/CardFrame';
import { ConfirmDialog } from '@frozik/components/ui/ConfirmDialog';
import {
  deleteUserTemplate,
  renameUserTemplate,
} from '@frozik/vault-app/document/application/template-actions';
import type { VaultSession } from '@frozik/vault-app/session/application/VaultSession';
import { NameDialog } from '../form/NameDialog';
import { vaultT } from '../texts/vault';

/** The user's own templates: renamed or deleted here, made from a card's menu. */
export const TemplatesSection = observer(({ session }: { readonly session: VaultSession }) => {
  const t = vaultT.templates;
  const [renaming, setRenaming] = useState<IUserTemplate | null>(null);
  const [deleting, setDeleting] = useState<IUserTemplate | null>(null);
  const templates = session.view.userTemplates;

  return (
    <CardFrame className="flex flex-col gap-3 p-6">
      <h3 className="text-[16px] font-medium text-landing-fg">{t.title}</h3>
      {templates.length === 0 ? (
        <p className="text-[13px] text-landing-fg-dim">{t.none}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {templates.map(template => (
            <li key={template.id} className="flex items-center gap-2 text-[13px] text-landing-fg">
              <span className="flex-1">{template.name}</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => setRenaming(template)}>
                {t.rename}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setDeleting(template)}>
                {t.delete}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {!isNil(renaming) && (
        <NameDialog
          title={t.rename}
          label={vaultT.menu.templateName}
          confirmLabel={t.rename}
          initial={renaming.name}
          onSubmit={name => session.transact(renameUserTemplate(renaming.id, name))}
          onClose={() => setRenaming(null)}
        />
      )}
      <ConfirmDialog
        open={!isNil(deleting)}
        title={t.deleteTitle(deleting?.name ?? '')}
        description={t.deleteMessage}
        confirmLabel={t.delete}
        cancelLabel={vaultT.menu.cancel}
        tone="danger"
        onConfirm={() => {
          if (!isNil(deleting)) {
            session.transact(deleteUserTemplate(deleting.id));
          }
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />
    </CardFrame>
  );
});
