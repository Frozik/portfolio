import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { TAssignableGroup } from '../../contexts/grouping/domain/group';
import { findGroup } from '../../contexts/grouping/domain/group-book';
import { moveTargets } from '../../contexts/grouping/domain/move-targets';
import type { ICallDay, ICallRow } from '../../contexts/journal/application/CallsStore';
import { useTexts } from '../../texts/use-texts';
import { useApp } from '../AppContext';
import { dayText } from '../format';
import { groupName } from '../group-name';
import { Chip } from '../kit/Chip';
import { Dot } from '../kit/Dot';
import { Hint } from '../kit/Hint';
import { GAP, GUTTER, SMALL_GAP, TEXT_SIZE, TOUCH_SIZE } from '../kit/metrics';
import { Section } from '../kit/Section';
import { useWordFit, WholeWordsText } from '../kit/WholeWordsText';
import { Wrap } from '../kit/Wrap';
import { usePalette, useScheme } from '../theme/AppTheme';
import { groupColor } from '../theme/group-colors';
import { callRing, callState } from './call-state';
import { CallerAvatar } from './CallerAvatar';
import { CallSheet } from './CallSheet';
import { moveEntry } from './move-caller';
import { MoveSheet } from './MoveSheet';
import { originText } from './origin-text';

/** A number shrinks rather than lose its last digits to an ellipsis. */
const NUMBER_MIN_SCALE = 0.7;

const CallRow = observer(function CallRow({
  row,
  quickTargets,
  showGroup,
  onOpen,
  onMove,
}: {
  readonly row: ICallRow;
  readonly quickTargets: readonly TAssignableGroup[];
  readonly showGroup: boolean;
  readonly onOpen: (row: ICallRow) => void;
  readonly onMove: (row: ICallRow) => void;
}) {
  const app = useApp();
  const texts = useTexts();
  const palette = usePalette();
  const scheme = useScheme();
  const { entry, group } = row;
  const { caller } = entry;
  const state = callState(entry.outcome);
  const local = entry.at.toZonedDateTimeISO(app.clock.timeZone());
  const title = caller.number === null ? texts.call.hidden : app.numbering.format(caller.number);
  const origin = originText(
    texts,
    caller.number === null ? null : app.numberingCatalogue.detailsOf(caller.number)
  );
  const time = texts.format.time(local.hour, local.minute);
  const groupLabel = `${groupName(texts, group)}${row.conflictWith.length > 0 ? ' ⚠' : ''}`;
  const groupFit = useWordFit(groupLabel);
  const names = [
    caller.contact?.displayName,
    caller.networkName === null ? undefined : `${caller.networkName} · ${texts.call.fromOperator}`,
  ].filter((name): name is string => name !== undefined);
  return (
    <View style={[styles.row, { borderBottomColor: palette.lineSoft }]}>
      <Pressable
        testID={`call-${entry.id}`}
        accessibilityRole="button"
        onPress={() => onOpen(row)}
        style={styles.main}
      >
        <CallerAvatar
          testID={`call-state-${state}`}
          ring={callRing(state, entry.answered)}
          photoUri={caller.contact === null ? null : app.contactPhotoUri(caller.contact.lookupKey)}
          name={caller.contact?.displayName ?? caller.networkName ?? entry.dialerName}
        />
        <View style={styles.text}>
          <Text
            style={[styles.title, { color: palette.fg }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={NUMBER_MIN_SCALE}
          >
            {title} {texts.call.calls(row.calls)}
          </Text>
          {names.map(name => (
            <Text key={name} style={[styles.subtitle, { color: palette.fgDim }]} numberOfLines={1}>
              {name}
            </Text>
          ))}
          {entry.dialerName === null ? null : (
            <Text
              testID={`call-dialer-name-${entry.id}`}
              style={[styles.subtitle, { color: palette.fgDim }]}
              numberOfLines={1}
            >
              {`${entry.dialerName} · ${texts.call.fromDialer}`}
            </Text>
          )}
          <View style={styles.when}>
            {origin === null ? null : (
              <Text
                testID={`call-origin-${entry.id}`}
                style={[styles.subtitle, styles.origin, { color: palette.fgDim }]}
                numberOfLines={1}
              >
                {origin}
              </Text>
            )}
            <Text style={[styles.subtitle, { color: palette.fgDim }]}>
              {origin === null ? time : ` · ${time}`}
            </Text>
          </View>
          {showGroup ? (
            <View style={styles.group}>
              <Dot color={groupColor(group.color, scheme)} />
              <WholeWordsText
                fit={groupFit}
                style={[styles.subtitle, styles.groupName, { color: palette.fgDim }]}
              >
                {groupLabel}
              </WholeWordsText>
            </View>
          ) : null}
        </View>
      </Pressable>
      {moveTargets(app.books.book, group.id, caller).length === 0 ? null : (
        <Pressable
          testID={`call-move-${entry.id}`}
          accessibilityRole="button"
          accessibilityLabel={texts.call.move}
          onPress={() => onMove(row)}
          style={styles.moveButton}
        >
          <Text style={[styles.moveGlyph, { color: palette.accent }]}>⇄</Text>
        </Pressable>
      )}
      {quickTargets.length === 0 ? null : (
        <View style={styles.quick}>
          <Wrap>
            {quickTargets.map(target => (
              <Chip
                key={target.id}
                testID={`call-quick-${target.id}-${entry.id}`}
                label={groupName(texts, target)}
                tint={groupColor(target.color, scheme)}
                onPress={() =>
                  moveEntry(app, entry, target.id, caller.number === null ? 'name' : 'number')
                }
              />
            ))}
          </Wrap>
        </View>
      )}
    </View>
  );
});

/** Calls by day; in «strangers» each row carries chips of the frequent groups, one tap to move. */
export const CallList = observer(function CallList({
  days,
  quickMove,
  showGroup,
}: {
  readonly days: readonly ICallDay[];
  readonly quickMove: boolean;
  readonly showGroup: boolean;
}) {
  const app = useApp();
  const texts = useTexts();
  const [opened, setOpened] = useState<ICallRow | null>(null);
  const [moving, setMoving] = useState<ICallRow | null>(null);
  const today = app.clock.localNow().toPlainDate();
  const quickTargets = quickMove
    ? app.calls.frequentTargets
        .map(id => findGroup(app.books.book, id))
        .filter((group): group is TAssignableGroup => group?.kind === 'custom')
    : [];
  if (days.length === 0) {
    return <Hint testID="calls-empty" text={texts.group.noCalls} />;
  }
  return (
    <>
      {days.map(day => (
        <Section key={day.date.toString()} title={dayText(texts, day.date, today)}>
          {day.rows.map(row => (
            <CallRow
              key={row.entry.id}
              row={row}
              showGroup={showGroup}
              quickTargets={
                row.group.kind === 'strangers' && row.entry.caller.number !== null
                  ? quickTargets
                  : []
              }
              onOpen={setOpened}
              onMove={setMoving}
            />
          ))}
        </Section>
      ))}
      <CallSheet
        row={opened}
        onClose={() => setOpened(null)}
        onMove={row => {
          setOpened(null);
          setMoving(row);
        }}
      />
      <MoveSheet row={moving} onClose={() => setMoving(null)} />
    </>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: GAP,
    paddingLeft: GUTTER,
    paddingVertical: 10,
    minHeight: TOUCH_SIZE,
  },
  text: { flex: 1, gap: 2 },
  title: { fontSize: TEXT_SIZE.body, fontWeight: '500' },
  subtitle: { fontSize: TEXT_SIZE.small },
  group: { flexDirection: 'row', alignItems: 'center', gap: SMALL_GAP },
  groupName: { flexShrink: 1 },
  when: { flexDirection: 'row' },
  origin: { flexShrink: 1 },
  moveButton: {
    width: TOUCH_SIZE,
    height: TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moveGlyph: { fontSize: TEXT_SIZE.title },
  quick: { width: '100%', paddingHorizontal: GUTTER, paddingBottom: 10, paddingLeft: GUTTER + 40 },
});
