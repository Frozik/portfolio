import { observer } from 'mobx-react-lite';
import { useState } from 'react';

import type { ICustomGroup } from '../../contexts/grouping/domain/group';
import { changeGroup } from '../../contexts/grouping/domain/group-book-edits';
import { useTexts } from '../../texts/use-texts';
import { useApp } from '../AppContext';
import { Button } from '../kit/Button';
import { Sheet } from '../kit/Sheet';
import { TextField } from '../kit/TextField';

/** The group's name, edited where it is shown. */
export const RenameSheet = observer(function RenameSheet({
  group,
  onClose,
}: {
  readonly group: ICustomGroup;
  readonly onClose: () => void;
}) {
  const app = useApp();
  const texts = useTexts();
  const [name, setName] = useState(group.name);
  const save = () => {
    app.books.run((book, context) =>
      changeGroup(book, group.id, { name: name.trim() }, context.now)
    );
    onClose();
  };
  return (
    <Sheet visible title={texts.group.rename} onClose={onClose} testID="rename-sheet">
      <TextField testID="group-name" label={texts.group.name} value={name} onChange={setName} />
      <Button
        testID="group-name-save"
        label={texts.common.save}
        disabled={name.trim() === ''}
        onPress={save}
      />
    </Sheet>
  );
});
