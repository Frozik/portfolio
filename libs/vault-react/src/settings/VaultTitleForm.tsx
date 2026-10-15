import { MultilineEditor } from '@frozik/components/components/RichEditor/MultilineEditor';
import { TextEditor } from '@frozik/components/components/RichEditor/TextEditor';
import type { IVaultTitle } from '@frozik/vault/model/vault-settings-edits';
import { useState } from 'react';

import { Button } from '@frozik/components/ui/Button';
import { VaultField } from '../form/VaultField';
import { settingsT } from '../texts/settings';

const DESCRIPTION_MAX_ROWS = 4;

/** The vault's name and its open description, saved together. */
export function VaultTitleForm({
  title,
  onRename,
}: {
  readonly title: IVaultTitle;
  readonly onRename: (title: IVaultTitle) => void;
}) {
  const t = settingsT;
  const [name, setName] = useState(title.name);
  const [description, setDescription] = useState(title.description);
  const unchanged = name.trim() === title.name && description.trim() === title.description;
  return (
    <>
      <VaultField label={t.name}>
        {() => <TextEditor aria-label={t.name} value={name} onValueChange={setName} />}
      </VaultField>
      <VaultField label={t.description} hint={t.descriptionHint}>
        {describedBy => (
          <MultilineEditor
            aria-label={t.description}
            aria-describedby={describedBy}
            maxRows={DESCRIPTION_MAX_ROWS}
            value={description}
            onValueChange={setDescription}
          />
        )}
      </VaultField>
      <Button
        type="button"
        variant="secondary"
        className="self-start"
        disabled={name.trim() === '' || unchanged}
        onClick={() => onRename({ name, description })}
      >
        {t.saveTitle}
      </Button>
    </>
  );
}
