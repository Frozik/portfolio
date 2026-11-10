import { useLocalSearchParams, useRouter } from 'expo-router';
import { Rainbow } from 'lucide-react-native';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { TMoveKey } from '../../contexts/grouping/domain/caller-move';
import type { TGroupColor } from '../../contexts/grouping/domain/group';
import { COLOR_SLOTS } from '../../contexts/grouping/domain/group';
import { freshColor } from '../../contexts/grouping/domain/group-book';
import { createGroup } from '../../contexts/grouping/domain/group-book-edits';
import type { TAction } from '../../contexts/policy/domain/action';
import { DEFAULT_REPEAT_WINDOW_MINUTES } from '../../contexts/policy/domain/policy';
import { REPEAT_OFF } from '../../contexts/policy/domain/repeat-pass';
import { useTexts } from '../../texts/use-texts';
import { useApp } from '../AppContext';
import { moveEntry } from '../calls/move-caller';
import { ColorSheet } from '../group/ColorSheet';
import { BackArrow } from '../kit/BackArrow';
import { Button } from '../kit/Button';
import { Chip } from '../kit/Chip';
import { Hint } from '../kit/Hint';
import { IconButton } from '../kit/IconButton';
import { SMALL_GAP } from '../kit/metrics';
import { Screen } from '../kit/Screen';
import { Swatch } from '../kit/Swatch';
import { TextField } from '../kit/TextField';
import { Wrap } from '../kit/Wrap';
import { useScheme } from '../theme/AppTheme';
import { groupColor } from '../theme/group-colors';

const ACTIONS: readonly TAction[] = ['block', 'pass'];

/** A new group: a name, a colour, what to do with its calls; from a call, the call goes into it. */
export const NewGroupScreen = observer(function NewGroupScreen() {
  const app = useApp();
  const texts = useTexts();
  const scheme = useScheme();
  const router = useRouter();
  const { entry: entryId, by } = useLocalSearchParams<{
    readonly entry?: string;
    readonly by?: TMoveKey;
  }>();
  const [name, setName] = useState('');
  const [color, setColor] = useState<TGroupColor>(() => freshColor(app.books.book));
  const [action, setAction] = useState<TAction>('block');
  const [picking, setPicking] = useState(false);
  const create = () => {
    const id = app.newGroupId();
    app.books.run((book, context) =>
      createGroup(book, {
        id,
        name: name.trim(),
        color,
        policy: {
          action,
          conditions: null,
          repeatPass: REPEAT_OFF,
          repeatWindowMinutes: DEFAULT_REPEAT_WINDOW_MINUTES,
        },
        now: context.now,
      })
    );
    const entry = app.calls.entries.find(candidate => candidate.id === entryId);
    if (entry !== undefined) {
      moveEntry(app, entry, id, by ?? 'number');
    }
    router.replace(`/group/${id}`);
  };
  return (
    <Screen
      testID="new-group-screen"
      titleLeading={<BackArrow testID="screen-back" />}
      title={texts.newGroup.title}
    >
      <TextField
        testID="new-group-name"
        label={texts.newGroup.name}
        value={name}
        onChange={setName}
        placeholder={texts.newGroup.placeholder}
      />
      <Hint text={texts.group.color} />
      <View style={styles.colors}>
        {COLOR_SLOTS.map(slot => (
          <Swatch
            key={slot}
            testID={`new-group-color-${slot}`}
            label={slot}
            color={groupColor(slot, scheme)}
            selected={slot === color}
            onPress={() => setColor(slot)}
          />
        ))}
        {(COLOR_SLOTS as readonly string[]).includes(color) ? null : (
          <Swatch
            testID="new-group-color-custom"
            label={color}
            color={groupColor(color, scheme)}
            selected
            onPress={() => setPicking(true)}
          />
        )}
        <IconButton
          testID="new-group-color-more"
          icon={Rainbow}
          label={texts.group.colorMore}
          onPress={() => setPicking(true)}
        />
      </View>
      {picking ? (
        <ColorSheet value={color} onChange={setColor} onClose={() => setPicking(false)} />
      ) : null}
      <Hint text={texts.newGroup.action} />
      <Wrap>
        {ACTIONS.map(candidate => (
          <Chip
            key={candidate}
            testID={`new-group-action-${candidate}`}
            label={texts.actions[candidate]}
            selected={candidate === action}
            onPress={() => setAction(candidate)}
          />
        ))}
      </Wrap>
      <Button
        testID="new-group-create"
        label={texts.newGroup.create}
        disabled={name.trim() === ''}
        onPress={create}
      />
    </Screen>
  );
});

const styles = StyleSheet.create({
  colors: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: SMALL_GAP * 2 },
});
