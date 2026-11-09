import { useLocalSearchParams } from 'expo-router';
import { Palette, Pencil } from 'lucide-react-native';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { TGroupId } from '../../contexts/grouping/domain/group';
import { findGroup } from '../../contexts/grouping/domain/group-book';
import { changeGroup } from '../../contexts/grouping/domain/group-book-edits';
import { useTexts } from '../../texts/use-texts';
import { useApp } from '../AppContext';
import { CallList } from '../calls/CallList';
import { groupName } from '../group-name';
import { statusText } from '../groups/group-status';
import { BackButton } from '../kit/BackButton';
import { Chip } from '../kit/Chip';
import { Dot } from '../kit/Dot';
import { Hint } from '../kit/Hint';
import { IconButton } from '../kit/IconButton';
import { GAP } from '../kit/metrics';
import { Screen } from '../kit/Screen';
import { Wrap } from '../kit/Wrap';
import { useScheme } from '../theme/AppTheme';
import { groupColor } from '../theme/group-colors';
import { AdvancedPanel } from './AdvancedPanel';
import { ColorSheet } from './ColorSheet';
import { MembersPanel } from './MembersPanel';
import { PolicyPanel } from './PolicyPanel';
import { RenameSheet } from './RenameSheet';

type TTab = 'calls' | 'rules';

/** A group: its calls first (the screen is for sorting them), its rules on the second tab. */
export const GroupScreen = observer(function GroupScreen() {
  const app = useApp();
  const texts = useTexts();
  const scheme = useScheme();
  const { id } = useLocalSearchParams<{ readonly id: string }>();
  const [tab, setTab] = useState<TTab>('calls');
  const [advanced, setAdvanced] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [coloring, setColoring] = useState(false);
  const group = findGroup(app.books.book, id as TGroupId);
  if (group === null) {
    return null;
  }
  const today = app.clock.localNow().toPlainDate();
  return (
    <Screen
      testID={`group-screen-${group.id}`}
      header={
        <View style={styles.header}>
          <BackButton testID="group-back" />
          <Dot color={groupColor(group.color, scheme)} />
        </View>
      }
      title={groupName(texts, group)}
      titleAction={
        <View style={styles.titleActions}>
          {group.kind === 'custom' ? (
            <IconButton
              testID="group-rename"
              icon={Pencil}
              label={texts.group.rename}
              onPress={() => setRenaming(true)}
            />
          ) : null}
          <IconButton
            testID="group-color"
            icon={Palette}
            label={texts.group.colorChange}
            onPress={() => setColoring(true)}
          />
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
      <Hint text={statusText(texts, app.statusOf(group), app.clock.timeZone(), today)} />
      <Wrap>
        <Chip
          testID="group-tab-calls"
          label={texts.group.calls}
          selected={tab === 'calls'}
          onPress={() => setTab('calls')}
        />
        <Chip
          testID="group-tab-rules"
          label={texts.group.rules}
          selected={tab === 'rules'}
          onPress={() => setTab('rules')}
        />
      </Wrap>
      {tab === 'calls' ? (
        <CallList
          days={app.calls.daysOf(group.id)}
          quickMove={group.kind === 'strangers'}
          showGroup={false}
        />
      ) : (
        <>
          {group.kind === 'strangers' ? (
            <Hint text={texts.group.strangersWho} />
          ) : (
            <MembersPanel group={group} />
          )}
          <PolicyPanel group={group} />
          <Chip
            testID="group-advanced"
            label={`${advanced ? '▾' : '▸'} ${texts.group.advanced}`}
            onPress={() => setAdvanced(!advanced)}
          />
          {advanced ? <AdvancedPanel group={group} /> : null}
        </>
      )}
    </Screen>
  );
});

const styles = StyleSheet.create({
  titleActions: { flexDirection: 'row' },
  header: { flexDirection: 'row', alignItems: 'center', gap: GAP },
});
