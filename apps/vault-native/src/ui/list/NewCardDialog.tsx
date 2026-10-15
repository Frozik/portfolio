import type { TTemplateId } from '@frozik/vault/model/ids';
import { observer } from 'mobx-react-lite';

import type { TTemplateChoice } from '@frozik/vault-app/document/application/template-choices';

import { Button } from '../kit/Button';
import { Dialog } from '../kit/Dialog';
import { useEditorTexts, useTemplateTranslator } from '../texts';

/** The templates a new card can start from; picking one starts the card. */
export const NewCardDialog = observer(function NewCardDialog({
  choices,
  onCreate,
  onClose,
}: {
  readonly choices: readonly TTemplateChoice[];
  readonly onCreate: (templateId: TTemplateId) => void;
  readonly onClose: () => void;
}) {
  const t = useEditorTexts();
  const translate = useTemplateTranslator();
  return (
    <Dialog testID="new-card-dialog" open title={t.newCard} onClose={onClose}>
      {choices.map(choice => (
        <Button
          key={choice.id}
          testID={`template-${choice.id}`}
          variant="secondary"
          label={choice.kind === 'builtin' ? translate(choice.nameKey) : choice.name}
          onPress={() => onCreate(choice.id)}
        />
      ))}
    </Dialog>
  );
});
