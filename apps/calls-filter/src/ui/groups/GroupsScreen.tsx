import { useRouter } from 'expo-router';
import { Pause, Plus, Power, PowerOff, Repeat, Trash2 } from 'lucide-react-native';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { TGroup } from '../../contexts/grouping/domain/group';
import { changeGroup, deleteGroup } from '../../contexts/grouping/domain/group-book-edits';
import { isActive } from '../../contexts/policy/domain/activity-now';
import { isRepeatPassOn } from '../../contexts/policy/domain/repeat-pass';
import { useTexts } from '../../texts/use-texts';
import { useApp } from '../AppContext';
import { momentText } from '../format';
import { groupName } from '../group-name';
import { Button } from '../kit/Button';
import { ConditionsMark } from '../kit/ConditionsMark';
import { Dot } from '../kit/Dot';
import { Hint } from '../kit/Hint';
import { IconButton } from '../kit/IconButton';
import { IndicatorButton } from '../kit/IndicatorButton';
import { GAP, RADIUS, SMALL_GAP, TEXT_SIZE } from '../kit/metrics';
import { PinnedMark } from '../kit/PinnedMark';
import { Row } from '../kit/Row';
import { Screen } from '../kit/Screen';
import { Section } from '../kit/Section';
import { SwipeAction } from '../kit/SwipeAction';
import { repeatText } from '../repeat/repeat-text';
import { RepeatSheet } from '../repeat/RepeatSheet';
import { usePalette, useScheme } from '../theme/AppTheme';
import { groupColor } from '../theme/group-colors';
import { ActionBackdrop } from './ActionBackdrop';
import { PauseSheet } from './PauseSheet';
import { ruleLine } from './rule-line';

const GroupRow = observer(function GroupRow({ group }: { readonly group: TGroup }) {
  const app = useApp();
  const texts = useTexts();
  const scheme = useScheme();
  const router = useRouter();
  const palette = usePalette();
  const conflicted = app.books.conflicts.some(conflict => conflict.groups.includes(group.id));
  const today = app.clock.localNow().toPlainDate();
  const status = app.statusOf(group);
  const line = ruleLine(texts, status, today);
  const { action } = group.policy;
  const row = (
    <Row
      testID={`group-${group.id}`}
      title={`${groupName(texts, group)}${conflicted ? ' ⚠' : ''}`}
      idle={!isActive(status.activity)}
      titleTrailing={
        <>
          {group.policy.conditions === null ? null : (
            <ConditionsMark testID={`group-conditioned-${group.id}`} />
          )}
          {group.kind === 'custom' ? null : <PinnedMark testID={`group-pinned-${group.id}`} />}
        </>
      }
      subtitle={line === null ? undefined : <Text testID={`group-${group.id}-status`}>{line}</Text>}
      separator="inset"
      backdrop={<ActionBackdrop action={action} testID={`group-${group.id}-action-${action}`} />}
      leading={
        <Dot
          testID={group.enabled ? `group-dot-${group.id}` : `group-dot-off-${group.id}`}
          color={groupColor(group.color, scheme)}
          hollow={!group.enabled}
        />
      }
      trailing={
        <Text style={{ color: palette.fgDim, fontSize: TEXT_SIZE.small }}>
          {texts.groups.callsToday(app.calls.countToday(group.id))}
        </Text>
      }
      onPress={() => router.push(`/group/${group.id}`)}
    />
  );
  return (
    <SwipeAction
      start={
        group.kind === 'custom'
          ? {
              icon: Trash2,
              label: texts.group.deleteGroup,
              tone: 'danger',
              testID: `group-delete-${group.id}`,
              onPress: () =>
                app.books.run((book, context) => deleteGroup(book, group.id, context.now)),
            }
          : undefined
      }
      end={{
        icon: group.enabled ? PowerOff : Power,
        label: group.enabled ? texts.groups.switchOff : texts.groups.switchOn,
        tone: group.enabled ? 'caution' : 'accent',
        testID: `group-switch-${group.id}`,
        onPress: () =>
          app.books.run((book, context) =>
            changeGroup(book, group.id, { enabled: !group.enabled }, context.now)
          ),
      }}
    >
      {row}
    </SwipeAction>
  );
});

export const GroupsScreen = observer(function GroupsScreen() {
  const app = useApp();
  const texts = useTexts();
  const palette = usePalette();
  const router = useRouter();
  const [pausing, setPausing] = useState(false);
  const [repeating, setRepeating] = useState(false);
  const { device, books, clock } = app;
  const today = clock.localNow().toPlainDate();
  const custom = books.book.groups.filter(group => group.kind === 'custom');
  const special = books.book.groups.filter(group => group.kind !== 'custom');
  const pausedUntil =
    device.isPaused && device.pausedUntil !== null
      ? device.pausedUntil.toZonedDateTimeISO(clock.timeZone()).toPlainDateTime()
      : null;
  return (
    <Screen
      testID="groups-screen"
      title={texts.groups.title}
      titleAction={
        <View style={styles.titleActions}>
          <IconButton
            testID="group-create"
            icon={Plus}
            label={texts.groups.newGroup}
            onPress={() => router.push('/group/new')}
          />
          <View style={styles.indicators}>
            <IndicatorButton
              testID="filter-repeat"
              icon={Repeat}
              tone="accent"
              filled={isRepeatPassOn(device.preferences.repeatPass, clock.now())}
              label={`${texts.repeat.title}: ${repeatText(texts, device.preferences.repeatPass, clock.now(), clock.timeZone(), today)}`}
              onPress={() => setRepeating(true)}
            />
            <IndicatorButton
              testID={pausedUntil === null ? 'pause-open' : 'pause-resume'}
              icon={Pause}
              tone="danger"
              filled={pausedUntil !== null}
              label={
                pausedUntil === null
                  ? `${texts.groups.filterOn}. ${texts.groups.pause}`
                  : texts.groups.resume
              }
              onPress={pausedUntil === null ? () => setPausing(true) : () => device.resume()}
            />
          </View>
        </View>
      }
    >
      {pausedUntil === null ? null : (
        <Hint
          testID="filter-paused-until"
          tone="danger"
          text={texts.groups.pausedUntil(momentText(texts, pausedUntil, today))}
        />
      )}
      {device.holdsRole ? null : (
        <View testID="role-missing" style={[styles.banner, { borderColor: palette.caution }]}>
          <Hint text={texts.groups.roleMissing} tone="caution" />
          <Button
            testID="role-request"
            label={texts.groups.roleButton}
            onPress={() => void device.requestRole()}
          />
        </View>
      )}
      {books.conflicts.length === 0 ? null : (
        <Button
          testID="conflicts-open"
          variant="secondary"
          label={texts.groups.conflicts(books.conflicts.length)}
          onPress={() => router.push('/conflicts')}
        />
      )}
      {custom.length === 0 ? <Hint testID="groups-empty" text={texts.groups.createFirst} /> : null}
      {custom.length === 0 ? null : (
        <Section>
          {custom.map(group => (
            <GroupRow key={group.id} group={group} />
          ))}
        </Section>
      )}
      <Section>
        {special.map(group => (
          <GroupRow key={group.id} group={group} />
        ))}
      </Section>
      <PauseSheet visible={pausing} onClose={() => setPausing(false)} />
      {repeating ? (
        <RepeatSheet
          value={device.preferences.repeatPass}
          hint={texts.repeat.filterHint}
          onChange={repeatPass => device.setRepeatPass(repeatPass)}
          onClose={() => setRepeating(false)}
        />
      ) : null}
    </Screen>
  );
});

const styles = StyleSheet.create({
  titleActions: { flexGrow: 1, flexShrink: 0, flexDirection: 'row', alignItems: 'center' },
  indicators: { marginLeft: 'auto', flexDirection: 'row', gap: SMALL_GAP },
  banner: { borderRadius: RADIUS, borderWidth: 1, padding: 14, gap: GAP },
});
