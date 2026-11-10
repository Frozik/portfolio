import { useRouter } from 'expo-router';
import { chunk, isNil } from 'lodash-es';
import {
  CalendarClock,
  CalendarDays,
  Hourglass,
  MapPin,
  MessageSquareText,
  Repeat,
} from 'lucide-react-native';
import { observer } from 'mobx-react-lite';
import type { ReactElement } from 'react';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { TGroup } from '../../contexts/grouping/domain/group';
import { changeGroup } from '../../contexts/grouping/domain/group-book-edits';
import { isTemporaryActive } from '../../contexts/policy/domain/action-now';
import { everBlocks } from '../../contexts/policy/domain/policy';
import { isRepeatPassOn } from '../../contexts/policy/domain/repeat-pass';
import { useTexts } from '../../texts/use-texts';
import { useApp } from '../AppContext';
import { IndicatorButton } from '../kit/IndicatorButton';
import { SMALL_GAP } from '../kit/metrics';
import { RepeatSheet } from '../repeat/RepeatSheet';
import { SmsReplySheet } from './SmsReplySheet';

const PER_ROW = 4;

/**
 * What a group has besides its action, as icons: first when it acts — schedule, calendars,
 * place, a change for a while — then the rest; each filled while the group has it, each opening
 * where it is set. A repeat call shows only on a group that ever blocks.
 */
export const SettingIcons = observer(function SettingIcons({
  group,
  onForAWhile,
  onLeave,
}: {
  readonly group: TGroup;
  readonly onForAWhile: () => void;
  /** Called before it opens the schedule, the calendars or a place: a sheet holding it closes then. */
  readonly onLeave?: () => void;
}) {
  const app = useApp();
  const router = useRouter();
  const open = (pathname: '/schedule' | '/calendars' | '/place') => {
    onLeave?.();
    router.push({ pathname, params: { group: group.id } });
  };
  const texts = useTexts();
  const [sheet, setSheet] = useState<'repeat' | 'sms' | null>(null);
  const { policy } = group;
  const { scheduled } = policy;
  const now = app.clock.now();
  const when: readonly ReactElement[] = [
    <IndicatorButton
      key="schedule"
      testID="add-schedule"
      icon={CalendarClock}
      tone="accent"
      filled={!isNil(scheduled?.schedule)}
      label={texts.group.schedule}
      caption={texts.group.schedule}
      onPress={() => open('/schedule')}
    />,
    <IndicatorButton
      key="calendars"
      testID="add-calendars"
      icon={CalendarDays}
      tone="accent"
      filled={(scheduled?.calendars.length ?? 0) > 0}
      label={texts.group.calendars}
      caption={texts.group.calendars}
      onPress={() => open('/calendars')}
    />,
    <IndicatorButton
      key="place"
      testID="add-place"
      icon={MapPin}
      tone="accent"
      filled={(scheduled?.places.length ?? 0) > 0}
      label={texts.place.add}
      caption={texts.place.short}
      onPress={() => open('/place')}
    />,
    <IndicatorButton
      key="temporary"
      testID="policy-for-a-while"
      icon={Hourglass}
      tone="accent"
      filled={isTemporaryActive(group.temporary, now)}
      label={texts.temporary.what}
      caption={texts.temporary.short}
      onPress={onForAWhile}
    />,
  ];
  const extras: readonly ReactElement[] = [
    ...(everBlocks(policy)
      ? [
          <IndicatorButton
            key="repeat"
            testID="group-repeat"
            icon={Repeat}
            tone="accent"
            filled={isRepeatPassOn(policy.repeatPass, now)}
            label={texts.repeat.title}
            caption={texts.repeat.short}
            onPress={() => setSheet('repeat')}
          />,
        ]
      : []),
    ...(app.smsReply
      ? [
          <IndicatorButton
            key="sms"
            testID="group-sms"
            icon={MessageSquareText}
            tone="accent"
            filled={group.autoReply !== null}
            label={texts.group.autoReply}
            caption={texts.group.smsShort}
            onPress={() => setSheet('sms')}
          />,
        ]
      : []),
  ];
  return (
    <>
      <IconRows icons={when} />
      <IconRows icons={extras} />
      {sheet === 'repeat' ? (
        <RepeatSheet
          value={policy.repeatPass}
          hint={texts.repeat.groupHint(policy.repeatWindowMinutes)}
          onChange={repeatPass =>
            app.books.run((book, context) =>
              changeGroup(book, group.id, { policy: { ...policy, repeatPass } }, context.now)
            )
          }
          onClose={() => setSheet(null)}
          window={{
            minutes: policy.repeatWindowMinutes,
            onChange: repeatWindowMinutes =>
              app.books.run((book, context) =>
                changeGroup(
                  book,
                  group.id,
                  { policy: { ...policy, repeatWindowMinutes } },
                  context.now
                )
              ),
          }}
        />
      ) : null}
      {sheet === 'sms' ? <SmsReplySheet group={group} onClose={() => setSheet(null)} /> : null}
    </>
  );
});

/** Icons a quarter of the width each, so the rows line up under one another. */
function IconRows({ icons }: { readonly icons: readonly ReactElement[] }) {
  return chunk(icons, PER_ROW).map(row => (
    <View key={row.map(icon => icon.key).join()} style={styles.row}>
      {row}
      {Array.from({ length: PER_ROW - row.length }, (_, slot) => (
        <View key={`empty-${slot}`} style={styles.empty} />
      ))}
    </View>
  ));
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SMALL_GAP },
  empty: { flex: 1 },
});
