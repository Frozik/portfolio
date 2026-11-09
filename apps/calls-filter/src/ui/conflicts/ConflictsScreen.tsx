import { observer } from 'mobx-react-lite';

import { conflictKey } from '../../contexts/grouping/domain/conflict';
import { useTexts } from '../../texts/use-texts';
import { useApp } from '../AppContext';
import { BackButton } from '../kit/BackButton';
import { Hint } from '../kit/Hint';
import { Screen } from '../kit/Screen';
import { Section } from '../kit/Section';
import { ConflictCard } from './ConflictCard';

/** Every open conflict with its answers; when none is left, the screen says so. */
export const ConflictsScreen = observer(function ConflictsScreen() {
  const app = useApp();
  const texts = useTexts();
  const { conflicts } = app.books;
  return (
    <Screen testID="conflicts-screen" title={texts.conflict.title} header={<BackButton />}>
      {conflicts.length === 0 ? <Hint testID="conflicts-none" text={texts.conflict.none} /> : null}
      {conflicts.map(conflict => (
        <Section key={conflictKey(conflict.groups)}>
          <ConflictCard
            conflict={conflict}
            resolutions={app.books.resolutionsOf(conflict)}
            onChoose={resolution => app.books.resolve(resolution)}
          />
        </Section>
      ))}
    </Screen>
  );
});
