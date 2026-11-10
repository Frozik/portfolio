import { useRouter } from 'expo-router';
import { observer } from 'mobx-react-lite';
import { View } from 'react-native';

import type { TMoveKey } from '../../contexts/grouping/domain/caller-move';
import type { TAssignableGroup } from '../../contexts/grouping/domain/group';
import { moveTargets } from '../../contexts/grouping/domain/move-targets';
import type { ICallRow } from '../../contexts/journal/application/CallsStore';
import { useTexts } from '../../texts/use-texts';
import { useApp } from '../AppContext';
import { groupName } from '../group-name';
import { Dot } from '../kit/Dot';
import { Hint } from '../kit/Hint';
import { Row } from '../kit/Row';
import { Section } from '../kit/Section';
import { Sheet } from '../kit/Sheet';
import { useScheme } from '../theme/AppTheme';
import { groupColor } from '../theme/group-colors';
import { moveEntry } from './move-caller';
import { MoveWays } from './MoveWays';

/** «To group…»: the frequent groups first, «+ New group» last; under each, the number or the operator's name. */
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
  if (row === null) {
    return null;
  }
  const { entry } = row;
  const { caller } = entry;
  const frequent = app.calls.frequentTargets;
  const targets = [...moveTargets(app.books.book, row.group.id, caller)].sort(
    (left, right) => rank(frequent, left) - rank(frequent, right)
  );
  const onlyBy: TMoveKey | null =
    caller.number === null ? 'name' : caller.networkName === null ? 'number' : null;
  const move = (group: TAssignableGroup, by: TMoveKey) => {
    moveEntry(app, entry, group.id, by);
    onClose();
  };
  const create = (by: TMoveKey) => {
    onClose();
    router.push({ pathname: '/group/new', params: { entry: entry.id, by } });
  };
  const ways = (testID: string, choose: (by: TMoveKey) => void) =>
    onlyBy === null ? (
      <MoveWays
        number={caller.number === null ? '' : app.numbering.format(caller.number)}
        name={caller.networkName ?? ''}
        testID={testID}
        onPick={choose}
      />
    ) : null;
  return (
    <Sheet visible title={texts.call.moveTitle} onClose={onClose} testID="move-sheet">
      {onlyBy === null ? <Hint text={texts.call.moveHow} /> : null}
      <Section>
        {targets.map(group => (
          <View key={group.id}>
            <Row
              testID={`move-to-${group.id}`}
              title={groupName(texts, group)}
              leading={<Dot color={groupColor(group.color, scheme)} />}
              separator={onlyBy === null ? 'none' : 'full'}
              onPress={onlyBy === null ? undefined : () => move(group, onlyBy)}
            />
            {ways(`move-to-${group.id}`, by => move(group, by))}
          </View>
        ))}
        <Row
          testID="move-new-group"
          title={texts.call.newGroup}
          separator={onlyBy === null ? 'none' : 'full'}
          onPress={onlyBy === null ? undefined : () => create(onlyBy)}
        />
        {ways('move-new-group', create)}
      </Section>
    </Sheet>
  );
});

function rank(frequent: readonly string[], group: TAssignableGroup): number {
  const index = frequent.indexOf(group.id);
  return index === -1 ? frequent.length + (group.kind === 'my-contacts' ? 1 : 0) : index;
}
