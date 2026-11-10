import { observer } from 'mobx-react-lite';
import { useState } from 'react';

import type { TGroup } from '../../contexts/grouping/domain/group';
import { changeGroup } from '../../contexts/grouping/domain/group-book-edits';
import { useTexts } from '../../texts/use-texts';
import { useApp } from '../AppContext';
import { Button } from '../kit/Button';
import { Hint } from '../kit/Hint';
import { Sheet } from '../kit/Sheet';
import { TextField } from '../kit/TextField';

/** The SMS a group answers a turned-away contact with; an empty text sends none. */
export const SmsReplySheet = observer(function SmsReplySheet({
  group,
  onClose,
}: {
  readonly group: TGroup;
  readonly onClose: () => void;
}) {
  const app = useApp();
  const texts = useTexts();
  const [reply, setReply] = useState(group.autoReply?.text ?? '');
  const save = () => {
    const text = reply.trim();
    app.books.run((book, context) =>
      changeGroup(book, group.id, { autoReply: text === '' ? null : { text } }, context.now)
    );
    onClose();
  };
  return (
    <Sheet visible title={texts.group.autoReply} onClose={onClose} testID="sms-reply-sheet">
      <TextField
        testID="auto-reply"
        label={texts.group.autoReply}
        value={reply}
        onChange={setReply}
        placeholder={texts.group.autoReply}
      />
      <Hint text={texts.group.autoReplyHint} />
      <Button testID="auto-reply-save" label={texts.common.save} onPress={save} />
    </Sheet>
  );
});
