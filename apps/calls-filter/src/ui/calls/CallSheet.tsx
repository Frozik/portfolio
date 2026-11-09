import { setStringAsync } from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { observer } from 'mobx-react-lite';
import { Linking } from 'react-native';

import { removeCallerFromGroup } from '../../contexts/grouping/domain/caller-move';
import { moveTargets } from '../../contexts/grouping/domain/move-targets';
import type { ICallRow } from '../../contexts/journal/application/CallsStore';
import { useTexts } from '../../texts/use-texts';
import { useApp } from '../AppContext';
import { groupName } from '../group-name';
import { Button } from '../kit/Button';
import { Hint } from '../kit/Hint';
import { Sheet } from '../kit/Sheet';
import { originText } from './origin-text';

/** A call opened: why it went where it went, and what can be done about the caller. */
export const CallSheet = observer(function CallSheet({
  row,
  onMove,
  onClose,
}: {
  readonly row: ICallRow | null;
  readonly onMove: (row: ICallRow) => void;
  readonly onClose: () => void;
}) {
  const app = useApp();
  const texts = useTexts();
  const router = useRouter();
  if (row === null) {
    return null;
  }
  const { entry, group } = row;
  const { caller, outcome } = entry;
  const number = caller.number === null ? null : app.numbering.format(caller.number);
  const origin = originText(
    texts,
    caller.number === null ? null : app.numberingCatalogue.detailsOf(caller.number)
  );
  const verdict =
    outcome.kind === 'screened' ? texts.verdicts[outcome.verdict] : texts.call.fromHistory;
  const remove = () => {
    app.books.run((book, context) =>
      removeCallerFromGroup(book, {
        caller,
        by: caller.number === null ? 'name' : 'number',
        group: group.id,
        newMemberId: context.newMemberId,
        now: context.now,
        facts: context.facts,
      })
    );
    onClose();
  };
  const similar = () => {
    onClose();
    router.push({
      pathname: '/mask',
      params: {
        group: group.kind === 'custom' ? group.id : '',
        side: 'include',
        seed: number ?? caller.networkName ?? '',
      },
    });
  };
  return (
    <Sheet
      visible
      title={caller.contact?.displayName ?? number ?? texts.call.hidden}
      onClose={onClose}
      testID="call-sheet"
    >
      {origin === null ? null : <Hint testID="call-sheet-origin" text={origin} />}
      <Hint text={texts.call.why(groupName(texts, group), verdict)} />
      {row.conflictWith.length === 0 ? null : (
        <Hint
          tone="caution"
          text={texts.call.inSeveral(
            [group, ...row.conflictWith].map(item => groupName(texts, item)).join(', ')
          )}
        />
      )}
      {number === null ? null : (
        <Button
          testID="call-back"
          variant="secondary"
          label={texts.call.callBack}
          onPress={() => void Linking.openURL(`tel:+${caller.number}`)}
        />
      )}
      {caller.contact === null ? null : (
        <Button
          testID="call-open-contact"
          variant="secondary"
          label={texts.call.openContact}
          onPress={() => app.openContact(caller.contact?.lookupKey ?? '')}
        />
      )}
      {moveTargets(app.books.book, group.id, caller).length === 0 ? null : (
        <Button testID="call-move" label={texts.call.move} onPress={() => onMove(row)} />
      )}
      {group.kind === 'strangers' ? null : (
        <Button
          testID="call-remove"
          variant="secondary"
          label={texts.call.remove}
          onPress={remove}
        />
      )}
      <Button
        testID="call-similar"
        variant="secondary"
        label={texts.call.similar}
        onPress={similar}
      />
      {number === null ? null : (
        <Button
          testID="call-copy"
          variant="quiet"
          label={texts.common.copy}
          onPress={() => void setStringAsync(number)}
        />
      )}
    </Sheet>
  );
});
