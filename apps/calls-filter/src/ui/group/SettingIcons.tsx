import { useRouter } from 'expo-router';
import { chunk, isNil } from 'lodash-es';
import {
  CalendarClock,
  CalendarDays,
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
import { isRepeatPassOn } from '../../contexts/policy/domain/repeat-pass';
import { useTexts } from '../../texts/use-texts';
import { useApp } from '../AppContext';
import { IndicatorButton } from '../kit/IndicatorButton';
import { SMALL_GAP } from '../kit/metrics';
import { SectionTitle } from '../kit/SectionTitle';
import { RepeatSheet } from '../repeat/RepeatSheet';
import { SmsReplySheet } from './SmsReplySheet';

const PER_ROW = 2;

/**
 * What a group has besides its action, as icons in two titled blocks: when it acts — schedule,
 * calendars, place — and what follows a rejected call; each filled while
 * the group has it, each opening where it is set. A repeat call shows only on a blocking group.
 */
export const SettingIcons = observer(function SettingIcons({
  group,
  onLeave,
}: {
  readonly group: TGroup;
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
  const { conditions } = policy;
  const now = app.clock.now();
  const when: readonly ReactElement[] = [
    <IndicatorButton
      key="schedule"
      testID="add-schedule"
      icon={CalendarClock}
      tone="accent"
      filled={!isNil(conditions?.schedule)}
      label={texts.group.schedule}
      caption={texts.group.schedule}
      onPress={() => open('/schedule')}
    />,
    <IndicatorButton
      key="calendars"
      testID="add-calendars"
      icon={CalendarDays}
      tone="accent"
      filled={(conditions?.calendars.length ?? 0) > 0}
      label={texts.group.calendars}
      caption={texts.group.calendars}
      onPress={() => open('/calendars')}
    />,
    <IndicatorButton
      key="place"
      testID="add-place"
      icon={MapPin}
      tone="accent"
      filled={(conditions?.places.length ?? 0) > 0}
      label={texts.place.add}
      caption={texts.place.short}
      onPress={() => open('/place')}
    />,
  ];
  const extras: readonly ReactElement[] = [
    ...(policy.action === 'block'
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
      <IconBlock title={texts.group.whenActs} icons={when} />
      {extras.length === 0 ? null : <IconBlock title={texts.group.whenRejected} icons={extras} />}
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

/** A titled block of icons, half the width each, so the rows line up under one another. */
function IconBlock({
  title,
  icons,
}: {
  readonly title: string;
  readonly icons: readonly ReactElement[];
}) {
  return (
    <View style={styles.block}>
      <SectionTitle title={title} />
      {chunk(icons, PER_ROW).map(row => (
        <View key={row.map(icon => icon.key).join()} style={styles.row}>
          {row}
          {Array.from({ length: PER_ROW - row.length }, (_, slot) => (
            <View key={`empty-${slot}`} style={styles.empty} />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: SMALL_GAP },
  row: { flexDirection: 'row', alignItems: 'center', gap: SMALL_GAP },
  empty: { flex: 1 },
});
