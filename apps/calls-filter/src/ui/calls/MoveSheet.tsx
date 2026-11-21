import { useRouter } from 'expo-router';
import { observer } from 'mobx-react-lite';
import { View } from 'react-native';

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
import { moveEntry, poolMoveOf } from './move-caller';
import type { TMoveWay } from './MoveWays';
import { MoveWays } from './MoveWays';
import { splitAtPool } from './number-pool-split';

/** «To group…»: the frequent groups first, «+ New group» last; for a stranger, the number or its pool under each. */
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
  const pool = poolMoveOf(app, texts, caller);
  const number = caller.number === null ? '' : app.numbering.format(caller.number);
  const move = (group: TAssignableGroup, way: TMoveWay = 'number') => {
    moveEntry(app, entry, group.id, way === 'pool' ? pool : null);
    onClose();
  };
  const create = (way: TMoveWay = 'number') => {
    onClose();
    router.push({
      pathname: '/group/new',
      params: way === 'pool' ? { entry: entry.id, pool: '1' } : { entry: entry.id },
    });
  };
  const ways = (testID: string, choose: (way: TMoveWay) => void) =>
    pool === null ? null : (
      <MoveWays
        number={number}
        pool={`${splitAtPool(number, pool.digits)[0]}…`}
        testID={testID}
        onPick={choose}
      />
    );
  return (
    <Sheet visible title={texts.call.moveTitle} onClose={onClose} testID="move-sheet">
      {pool === null ? null : <Hint text={texts.call.moveHow} />}
      <Section>
        {targets.map(group => (
          <View key={group.id}>
            <Row
              testID={`move-to-${group.id}`}
              title={groupName(texts, group)}
              leading={<Dot color={groupColor(group.color, scheme)} />}
              separator={pool === null ? 'full' : 'none'}
              onPress={pool === null ? () => move(group) : undefined}
            />
            {ways(`move-to-${group.id}`, way => move(group, way))}
          </View>
        ))}
        <Row
          testID="move-new-group"
          title={texts.call.newGroup}
          separator={pool === null ? 'full' : 'none'}
          onPress={pool === null ? () => create() : undefined}
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
