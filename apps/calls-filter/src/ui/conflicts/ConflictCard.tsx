import { observer } from 'mobx-react-lite';

import type { IConflict } from '../../contexts/grouping/domain/conflict';
import type { IResolution } from '../../contexts/grouping/domain/conflict-resolutions';
import { findGroup } from '../../contexts/grouping/domain/group-book';
import { useTexts } from '../../texts/use-texts';
import { useApp } from '../AppContext';
import { groupName } from '../group-name';
import { Button } from '../kit/Button';
import { Hint } from '../kit/Hint';
import { exampleText, groupNames } from './conflict-texts';

/** A conflict and its ready answers, each one tap. */
export const ConflictCard = observer(function ConflictCard({
  conflict,
  resolutions,
  onChoose,
}: {
  readonly conflict: IConflict;
  readonly resolutions: readonly IResolution[];
  readonly onChoose: (resolution: IResolution) => void;
}) {
  const app = useApp();
  const texts = useTexts();
  const name = (id: IResolution['winner']) => {
    const group = findGroup(app.books.book, id);
    return group === null ? '' : groupName(texts, group);
  };
  return (
    <>
      <Hint text={texts.conflict.between(groupNames(texts, app.books.book, conflict.groups))} />
      <Hint text={texts.conflict.example(exampleText(texts, conflict, app.numbering))} />
      {conflict.knownCallers.length === 0 ? null : (
        <Hint text={texts.conflict.knownCalls(conflict.knownCallers.length)} />
      )}
      {resolutions.map(resolution => (
        <Button
          key={`${resolution.kind}-${resolution.winner}`}
          testID={`resolve-${resolution.kind}-${resolution.winner}`}
          variant={resolution.kind === 'keep-in' ? 'primary' : 'secondary'}
          label={
            resolution.kind === 'keep-in'
              ? texts.conflict.keepIn(name(resolution.winner))
              : texts.conflict.keepKnownIn(name(resolution.winner))
          }
          onPress={() => onChoose(resolution)}
        />
      ))}
    </>
  );
});
