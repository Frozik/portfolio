import { observer } from 'mobx-react-lite';
import { useState } from 'react';

import type { TGroup } from '../../contexts/grouping/domain/group';
import { changeGroup, deleteGroup } from '../../contexts/grouping/domain/group-book-edits';
import { useTexts } from '../../texts/use-texts';
import { useApp } from '../AppContext';
import { Button } from '../kit/Button';
import { Chip } from '../kit/Chip';
import { Hint } from '../kit/Hint';
import { TextField } from '../kit/TextField';
import { useLeave } from '../kit/use-leave';
import { Wrap } from '../kit/Wrap';

const REPEAT_WINDOWS = [2, 5, 10, 15] as const;

/** «More»: the repeat window, the SMS reply, deleting the group. */
export const AdvancedPanel = observer(function AdvancedPanel({
  group,
}: {
  readonly group: TGroup;
}) {
  const app = useApp();
  const texts = useTexts();
  const leave = useLeave();
  const [reply, setReply] = useState(group.autoReply?.text ?? '');
  const change = (settings: Parameters<typeof changeGroup>[2]) =>
    app.books.run((book, context) => changeGroup(book, group.id, settings, context.now));
  return (
    <>
      <Hint text={texts.group.repeatWindow(group.policy.repeatWindowMinutes)} />
      <Wrap>
        {REPEAT_WINDOWS.map(minutes => (
          <Chip
            key={minutes}
            testID={`repeat-window-${minutes}`}
            label={String(minutes)}
            selected={group.policy.repeatWindowMinutes === minutes}
            onPress={() => change({ policy: { ...group.policy, repeatWindowMinutes: minutes } })}
          />
        ))}
      </Wrap>
      <TextField
        testID="auto-reply"
        label={texts.group.autoReply}
        value={reply}
        onChange={setReply}
        placeholder={texts.group.autoReply}
      />
      <Hint text={texts.group.autoReplyHint} />
      <Button
        testID="auto-reply-save"
        variant="secondary"
        label={texts.common.save}
        onPress={() => change({ autoReply: reply.trim() === '' ? null : { text: reply.trim() } })}
      />
      {group.kind === 'custom' ? (
        <>
          <Button
            testID="group-delete"
            variant="danger"
            label={texts.group.deleteGroup}
            onPress={() => {
              app.books.run((book, context) => deleteGroup(book, group.id, context.now));
              leave();
            }}
          />
        </>
      ) : null}
    </>
  );
});
