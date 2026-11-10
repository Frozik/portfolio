import type { ICustomGroup } from '../../contexts/grouping/domain/group';
import { deleteGroup } from '../../contexts/grouping/domain/group-book-edits';
import { useTexts } from '../../texts/use-texts';
import { useApp } from '../AppContext';
import { Button } from '../kit/Button';
import { useLeave } from '../kit/use-leave';

/** The end of a group's rules: deleting it, then back to where the user came from. */
export function DeleteGroupButton({ group }: { readonly group: ICustomGroup }) {
  const app = useApp();
  const texts = useTexts();
  const leave = useLeave();
  return (
    <Button
      testID="group-delete"
      variant="danger"
      label={texts.group.deleteGroup}
      onPress={() => {
        app.books.run((book, context) => deleteGroup(book, group.id, context.now));
        leave();
      }}
    />
  );
}
