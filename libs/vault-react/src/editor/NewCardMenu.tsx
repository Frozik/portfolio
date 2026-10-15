import { Select } from '@frozik/components/components/select/Select';
import type { TTemplateId } from '@frozik/vault/model/ids';
import { Plus } from 'lucide-react';
import { observer } from 'mobx-react-lite';

import type { TTemplateChoice } from '@frozik/vault-app/document/application/template-choices';
import { editorT } from '../texts/editor';
import { LANGUAGE } from '../texts/language';
import { translateTemplateKey } from '../texts/templates';

const ICON_SIZE = 16;

/** "+" and the templates a new card can start from; picking one starts the card. */
export const NewCardMenu = observer(
  ({
    choices,
    disabled,
    onCreate,
  }: {
    readonly choices: readonly TTemplateChoice[];
    readonly disabled: boolean;
    readonly onCreate: (templateId: TTemplateId) => void;
  }) => (
    <div data-testid="new-card">
      <Select<TTemplateId>
        aria-label={editorT.newCard}
        icon={<Plus size={ICON_SIZE} />}
        options={choices.map(choice => ({
          value: choice.id,
          label: choice.kind === 'builtin' ? translateTemplateKey(choice.nameKey) : choice.name,
        }))}
        value={undefined}
        disabled={disabled}
        onValueChange={onCreate}
        locale={LANGUAGE}
      />
    </div>
  )
);
