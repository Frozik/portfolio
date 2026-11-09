import { useRouter } from 'expo-router';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';

import type { TMoveKey } from '../../contexts/grouping/domain/caller-move';
import type { TAssignableGroup } from '../../contexts/grouping/domain/group';
import { moveTargets } from '../../contexts/grouping/domain/move-targets';
import type { ICallRow } from '../../contexts/journal/application/CallsStore';
import { useTexts } from '../../texts/use-texts';
import { useApp } from '../AppContext';
import { groupName } from '../group-name';
import { Chip } from '../kit/Chip';
import { Dot } from '../kit/Dot';
import { Row } from '../kit/Row';
import { Section } from '../kit/Section';
import { Sheet } from '../kit/Sheet';
import { Wrap } from '../kit/Wrap';
import { useScheme } from '../theme/AppTheme';
import { groupColor } from '../theme/group-colors';
import { moveEntry } from './move-caller';

/** «To group…»: the frequent groups first, «+ New group» last, by number or by the operator's name. */
export const MoveSheet = observer(function MoveSheet({
  row,
  onClose,
}: {
  readonly row: ICallRow | null;
  readonly onClose: () => void;
}) {
  const app = useApp();
  const texts = useTexts();
  const scheme = useScheme();
  const router = useRouter();
  const [by, setBy] = useState<TMoveKey>('number');
  if (row === null) {
    return null;
  }
  const { entry } = row;
  const { caller } = entry;
  const frequent = app.calls.frequentTargets;
  const targets = [...moveTargets(app.books.book, row.group.id, caller)].sort(
    (left, right) => rank(frequent, left) - rank(frequent, right)
  );
  const move = (group: TAssignableGroup) => {
    moveEntry(app, entry, group.id, caller.number === null ? 'name' : by);
    onClose();
  };
  const create = () => {
    onClose();
    router.push({ pathname: '/group/new', params: { entry: entry.id, by } });
  };
  return (
    <Sheet visible title={texts.call.moveTitle} onClose={onClose} testID="move-sheet">
      {caller.networkName === null || caller.number === null ? null : (
        <Wrap>
          <Chip
            testID="move-by-number"
            label={texts.call.byNumber}
            selected={by === 'number'}
            onPress={() => setBy('number')}
          />
          <Chip
            testID="move-by-name"
            label={texts.call.byName}
            selected={by === 'name'}
            onPress={() => setBy('name')}
          />
        </Wrap>
      )}
      <Section>
        {targets.map(group => (
          <Row
            key={group.id}
            testID={`move-to-${group.id}`}
            title={groupName(texts, group)}
            leading={<Dot color={groupColor(group.color, scheme)} />}
            onPress={() => move(group)}
          />
        ))}
        <Row testID="move-new-group" title={texts.call.newGroup} onPress={create} />
      </Section>
    </Sheet>
  );
});

function rank(frequent: readonly string[], group: TAssignableGroup): number {
  const index = frequent.indexOf(group.id);
  return index === -1 ? frequent.length + (group.kind === 'my-contacts' ? 1 : 0) : index;
}
