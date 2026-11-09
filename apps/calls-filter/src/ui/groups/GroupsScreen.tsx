import { useRouter } from 'expo-router';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { TGroup } from '../../contexts/grouping/domain/group';
import { useTexts } from '../../texts/use-texts';
import { useApp } from '../AppContext';
import { momentText } from '../format';
import { groupName } from '../group-name';
import { Button } from '../kit/Button';
import { Dot } from '../kit/Dot';
import { Hint } from '../kit/Hint';
import { GAP, RADIUS, TEXT_SIZE } from '../kit/metrics';
import { Row } from '../kit/Row';
import { Screen } from '../kit/Screen';
import { Section } from '../kit/Section';
import { RepeatRow } from '../repeat/RepeatRow';
import { usePalette, useScheme } from '../theme/AppTheme';
import { groupColor } from '../theme/group-colors';
import { statusText } from './group-status';
import { PauseSheet } from './PauseSheet';
import { TemporarySheet } from './TemporarySheet';

const GroupRow = observer(function GroupRow({
  group,
  onLongPress,
}: {
  readonly group: TGroup;
  readonly onLongPress: (group: TGroup) => void;
}) {
  const app = useApp();
  const texts = useTexts();
  const scheme = useScheme();
  const router = useRouter();
  const palette = usePalette();
  const conflicted = app.books.conflicts.some(conflict => conflict.groups.includes(group.id));
  const today = app.clock.localNow().toPlainDate();
  return (
    <Row
      testID={`group-${group.id}`}
      title={`${groupName(texts, group)}${conflicted ? ' ⚠' : ''}`}
      subtitle={statusText(texts, app.statusOf(group), app.clock.timeZone(), today)}
      leading={<Dot color={groupColor(group.color, scheme)} />}
      trailing={
        <Text style={{ color: palette.fgDim, fontSize: TEXT_SIZE.small }}>
          {texts.groups.callsToday(app.calls.countToday(group.id))}
        </Text>
      }
      onPress={() => router.push(`/group/${group.id}`)}
      onLongPress={() => onLongPress(group)}
    />
  );
});

export const GroupsScreen = observer(function GroupsScreen() {
  const app = useApp();
  const texts = useTexts();
  const palette = usePalette();
  const router = useRouter();
  const [pausing, setPausing] = useState(false);
  const [temporaryFor, setTemporaryFor] = useState<TGroup | null>(null);
  const { device, books } = app;
  const custom = books.book.groups.filter(group => group.kind === 'custom');
  const special = books.book.groups.filter(group => group.kind !== 'custom');
  const pausedUntil =
    device.isPaused && device.pausedUntil !== null
      ? device.pausedUntil.toZonedDateTimeISO(app.clock.timeZone()).toPlainDateTime()
      : null;
  return (
    <Screen testID="groups-screen" title={texts.groups.title}>
      <View
        testID="filter-status"
        style={[
          styles.status,
          {
            backgroundColor: pausedUntil === null ? palette.bgCard : palette.accentSoft,
            borderColor: palette.lineSoft,
          },
        ]}
      >
        <Text style={[styles.statusText, { color: palette.fg }]}>
          {pausedUntil === null
            ? texts.groups.filterOn
            : texts.groups.pausedUntil(
                momentText(texts, pausedUntil, app.clock.localNow().toPlainDate())
              )}
        </Text>
        {pausedUntil === null ? (
          <Button
            testID="pause-open"
            variant="secondary"
            label={texts.groups.pause}
            onPress={() => setPausing(true)}
          />
        ) : (
          <Button
            testID="pause-resume"
            label={texts.groups.resume}
            onPress={() => device.resume()}
          />
        )}
      </View>
      <Section>
        <RepeatRow
          testID="filter-repeat"
          value={device.preferences.repeatPass}
          hint={texts.repeat.filterHint}
          onChange={repeatPass => device.setRepeatPass(repeatPass)}
        />
      </Section>
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
            <GroupRow key={group.id} group={group} onLongPress={setTemporaryFor} />
          ))}
        </Section>
      )}
      <Section>
        {special.map(group => (
          <GroupRow key={group.id} group={group} onLongPress={setTemporaryFor} />
        ))}
      </Section>
      <Button
        testID="group-create"
        label={`+ ${texts.groups.newGroup}`}
        onPress={() => router.push('/group/new')}
      />
      <PauseSheet visible={pausing} onClose={() => setPausing(false)} />
      <TemporarySheet group={temporaryFor} onClose={() => setTemporaryFor(null)} />
    </Screen>
  );
});

const styles = StyleSheet.create({
  status: {
    borderRadius: RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: GAP,
  },
  statusText: { flex: 1, fontSize: TEXT_SIZE.heading, fontWeight: '600' },
  banner: { borderRadius: RADIUS, borderWidth: 1, padding: 14, gap: GAP },
});
