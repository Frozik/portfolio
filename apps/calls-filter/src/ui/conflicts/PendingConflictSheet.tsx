import { observer } from 'mobx-react-lite';

import { useTexts } from '../../texts/use-texts';
import { useApp } from '../AppContext';
import { Button } from '../kit/Button';
import { Sheet } from '../kit/Sheet';
import { ConflictCard } from './ConflictCard';

/** An edit that would put a caller in two groups waits here for the user's answer. */
export const PendingConflictSheet = observer(function PendingConflictSheet() {
  const app = useApp();
  const texts = useTexts();
  const { pending } = app.books;
  if (pending === null) {
    return null;
  }
  return (
    <Sheet
      visible
      title={texts.conflict.title}
      onClose={() => app.books.cancelPending()}
      testID="pending-conflict"
    >
      <ConflictCard
        conflict={pending.conflict}
        resolutions={pending.resolutions}
        onChoose={resolution => app.books.choose(resolution)}
      />
      <Button
        testID="pending-cancel"
        variant="quiet"
        label={texts.common.cancel}
        onPress={() => app.books.cancelPending()}
      />
    </Sheet>
  );
});
