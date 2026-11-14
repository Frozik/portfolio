import { useLocalSearchParams } from 'expo-router';
import { Funnel, PhoneIncoming, PhoneOff } from 'lucide-react-native';
import { observer } from 'mobx-react-lite';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { TGroupId } from '../../contexts/grouping/domain/group';
import { findGroup } from '../../contexts/grouping/domain/group-book';
import { changeGroup } from '../../contexts/grouping/domain/group-book-edits';
import { isActive } from '../../contexts/policy/domain/activity-now';
import { useTexts } from '../../texts/use-texts';
import { useApp } from '../AppContext';
import { groupName } from '../group-name';
import { statusText } from '../groups/group-status';
import { BackArrow } from '../kit/BackArrow';
import { Dot } from '../kit/Dot';
import { Hint } from '../kit/Hint';
import { IndicatorButton } from '../kit/IndicatorButton';
import { SMALL_GAP } from '../kit/metrics';
import { PinnedMark } from '../kit/PinnedMark';
import { Screen } from '../kit/Screen';
import { SegmentedControl } from '../kit/SegmentedControl';
import { useBackCloses } from '../kit/use-back-closes';
import { useLeaveWhenGone } from '../kit/use-leave-when-gone';
import { useScheme } from '../theme/AppTheme';
import { groupColor } from '../theme/group-colors';
import { ColorSheet } from './ColorSheet';
import { DeleteGroupButton } from './DeleteGroupButton';
import { GroupCalls } from './GroupCalls';
import { MembersPanel } from './MembersPanel';
import { PolicyPanel } from './PolicyPanel';
import { PolicySheet } from './PolicySheet';
import { PolicySwitches } from './PolicySwitches';
import { RenameSheet } from './RenameSheet';

type TTab = 'calls' | 'rules';

/** A group: its calls first (the screen is for sorting them), its rules on the second tab. */
/** The dot is small; the finger gets a wider target around it. */
const DOT_HIT_SLOP = 12;

export const GroupScreen = observer(function GroupScreen() {
  const app = useApp();
  const texts = useTexts();
  const scheme = useScheme();
  const { id } = useLocalSearchParams<{ readonly id: string }>();
  const [tab, setTab] = useState<TTab>('calls');
  const [query, setQuery] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [coloring, setColoring] = useState(false);
  const [policySheet, setPolicySheet] = useState(false);
  const closeSearch = useCallback(() => setQuery(null), []);
  useBackCloses(query !== null, closeSearch);
  const group = findGroup(app.books.book, id as TGroupId);
  useLeaveWhenGone(group === null);
  if (group === null) {
    return null;
  }
  const today = app.clock.localNow().toPlainDate();
  const status = app.statusOf(group);
  const days = app.calls.daysOf(group.id);
  const chooseTab = (next: TTab) => {
    setTab(next);
    setQuery(null);
  };
  return (
    <Screen
      testID={`group-screen-${group.id}`}
      titleLeading={
        <View style={styles.titleLeading}>
          <BackArrow testID="group-back" />
          <Pressable
            testID="group-color"
            accessibilityRole="button"
            accessibilityLabel={texts.group.colorChange}
            hitSlop={DOT_HIT_SLOP}
            onPress={() => setColoring(true)}
            onLongPress={() => setColoring(true)}
          >
            <Dot
              testID={group.enabled ? 'group-dot' : 'group-dot-off'}
              color={groupColor(group.color, scheme)}
              hollow={!group.enabled}
            />
          </Pressable>
        </View>
      }
      title={groupName(texts, group)}
      onTitlePress={group.kind === 'custom' ? () => setRenaming(true) : undefined}
      titleTestID="group-rename"
      titleIdle={!isActive(status.activity)}
      titleAction={
        <View style={styles.titleActions}>
          {group.kind === 'custom' ? null : <PinnedMark testID="group-pinned" />}
          <View style={styles.status}>
            <IndicatorButton
              testID="group-status"
              icon={group.policy.action === 'block' ? PhoneOff : PhoneIncoming}
              tone={group.policy.action === 'block' ? 'danger' : 'positive'}
              filled
              label={statusText(texts, group.policy, status, today)}
              onPress={() => setPolicySheet(true)}
            />
          </View>
        </View>
      }
    >
      {coloring ? (
        <ColorSheet
          value={group.color}
          onChange={color =>
            app.books.run((book, context) => changeGroup(book, group.id, { color }, context.now))
          }
          onClose={() => setColoring(false)}
        />
      ) : null}
      {renaming && group.kind === 'custom' ? (
        <RenameSheet group={group} onClose={() => setRenaming(false)} />
      ) : null}
      {policySheet ? <PolicySheet group={group} onClose={() => setPolicySheet(false)} /> : null}
      <SegmentedControl
        segments={[
          {
            value: 'calls',
            label: texts.group.calls,
            testID: 'group-tab-calls',
            toggle:
              days.length === 0
                ? undefined
                : {
                    icon: Funnel,
                    label: texts.group.search,
                    value: query !== null,
                    onChange: open => setQuery(open ? '' : null),
                    testID: 'group-search',
                  },
          },
          { value: 'rules', label: texts.group.rules, testID: 'group-tab-rules' },
        ]}
        value={tab}
        onChange={chooseTab}
      />
      {tab === 'calls' ? (
        <GroupCalls
          days={days}
          quickMove={group.kind === 'strangers'}
          query={query}
          onQuery={setQuery}
        />
      ) : (
        <>
          <PolicySwitches group={group} />
          {group.kind === 'strangers' ? (
            <Hint text={texts.group.strangersWho} />
          ) : (
            <MembersPanel group={group} />
          )}
          <PolicyPanel group={group} />
          {group.kind === 'custom' ? <DeleteGroupButton group={group} /> : null}
        </>
      )}
    </Screen>
  );
});

const styles = StyleSheet.create({
  // Never narrower than its buttons: a long name shrinks into its ellipsis instead of under them.
  titleActions: { flexGrow: 1, flexShrink: 0, flexDirection: 'row', alignItems: 'center' },
  status: { marginLeft: 'auto' },
  titleLeading: { flexDirection: 'row', alignItems: 'center', gap: SMALL_GAP },
});
