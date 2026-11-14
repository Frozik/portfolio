import type { ICustomGroup } from '../../contexts/grouping/domain/group';
import { deleteGroup } from '../../contexts/grouping/domain/group-book-edits';
import { useTexts } from '../../texts/use-texts';
import { useApp } from '../AppContext';
import { Button } from '../kit/Button';

/** The end of a group's rules: deleting it. Its screen, the group gone, leaves by itself. */
export function DeleteGroupButton({ group }: { readonly group: ICustomGroup }) {
  const app = useApp();
  const texts = useTexts();
  return (
    <Button
      testID="group-delete"
      variant="danger"
      label={texts.group.deleteGroup}
      onPress={() => app.books.run((book, context) => deleteGroup(book, group.id, context.now))}
    />
  );
}
