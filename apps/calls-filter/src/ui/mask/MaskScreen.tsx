import { useLocalSearchParams } from 'expo-router';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { assertNever } from '@frozik/utils/assert/assertNever';
import type { TGroupId } from '../../contexts/grouping/domain/group';
import { findGroup } from '../../contexts/grouping/domain/group-book';
import { findMask } from '../../contexts/grouping/domain/group-book';
import { addMember, replaceMask } from '../../contexts/grouping/domain/group-book-edits';
import type { TMemberId, TNameField } from '../../contexts/grouping/domain/member';
import type { TMaskKind } from '../../contexts/masks/application/MaskEditor';
import { MaskEditor } from '../../contexts/masks/application/MaskEditor';
import { useTexts } from '../../texts/use-texts';
import { useApp } from '../AppContext';
import { BackArrow } from '../kit/BackArrow';
import { Button } from '../kit/Button';
import { Chip } from '../kit/Chip';
import { Hint } from '../kit/Hint';
import { RADIUS, TEXT_SIZE } from '../kit/metrics';
import { Screen } from '../kit/Screen';
import { TextField } from '../kit/TextField';
import { useLeave } from '../kit/use-leave';
import { useLeaveWhenGone } from '../kit/use-leave-when-gone';
import { Wrap } from '../kit/Wrap';
import { usePalette } from '../theme/AppTheme';
import { NumberKeypad } from './NumberKeypad';

const FIELDS: readonly TNameField[] = ['any', 'network', 'contact'];

const MaskState = observer(function MaskState({ editor }: { readonly editor: MaskEditor }) {
  const texts = useTexts();
  const { state } = editor;
  switch (state.kind) {
    case 'empty':
      return null;
    case 'invalid':
      return (
        <>
          {state.errors.map(error => (
            <Hint
              key={JSON.stringify(error)}
              testID="mask-error"
              tone="danger"
              text={texts.mask.error(error)}
            />
          ))}
        </>
      );
    case 'not-here':
      return <Hint testID="mask-error" tone="danger" text={texts.mask.canonical(state.error)} />;
    case 'valid':
      return (
        <>
          <Hint
            testID="mask-description"
            text={texts.mask.describe(state.tokens, state.international)}
          />
          <Hint text={texts.mask.example(state.example)} />
          {state.takesEveryone ? <Hint tone="caution" text={texts.mask.wholeStar} /> : null}
          {editor.matchingCalls > 0 ? (
            <Hint text={texts.mask.matchingCalls(editor.matchingCalls)} />
          ) : null}
        </>
      );
    default:
      return assertNever(state);
  }
});

/** A mask of a number or a name: typed with its own keypad, explained in words, tried on a number. */
export const MaskScreen = observer(function MaskScreen() {
  const app = useApp();
  const texts = useTexts();
  const palette = usePalette();
  const leave = useLeave();
  const params = useLocalSearchParams<{
    readonly group?: string;
    readonly side?: 'include' | 'exclude';
    readonly seed?: string;
    readonly kind?: TMaskKind;
    /** The mask of the group to rewrite, instead of adding a new one. */
    readonly member?: string;
  }>();
  const side = params.side ?? 'include';
  const groupId =
    params.group === undefined || params.group === '' ? null : (params.group as TGroupId);
  useLeaveWhenGone(groupId !== null && findGroup(app.books.book, groupId) === null);
  const [editor] = useState(() => {
    const rewritten =
      groupId === null || params.member === undefined
        ? null
        : findMask(app.books.book, groupId, side, params.member as TMemberId);
    return new MaskEditor(
      {
        environment: () => app.environment,
        numbering: app.numbering,
        knownCallers: () => app.facts.knownCallers,
        newMemberId: () => app.books.context().newMemberId(),
        now: () => app.clock.now(),
      },
      rewritten === null
        ? { kind: 'new', mask: params.kind ?? 'number', seed: params.seed ?? '' }
        : { kind: 'rewrite', member: rewritten }
    );
  });
  const save = () => {
    const { member } = editor;
    if (member === null || groupId === null) {
      return;
    }
    const result = app.books.run((book, context) =>
      editor.rewrites
        ? replaceMask(book, {
            group: groupId,
            side,
            member,
            now: context.now,
            facts: context.facts,
          })
        : addMember(book, {
            group: groupId,
            side,
            member,
            newMemberId: context.newMemberId,
            now: context.now,
            facts: context.facts,
          })
    );
    if (result === 'applied') {
      leave();
    }
  };
  const sample = editor.sampleMatches;
  return (
    <Screen
      testID="mask-screen"
      title={texts.mask.title}
      titleLeading={<BackArrow testID="screen-back" />}
    >
      <Wrap>
        <Chip
          testID="mask-kind-number"
          label={texts.mask.number}
          selected={editor.kind === 'number'}
          onPress={() => editor.setKind('number')}
        />
        <Chip
          testID="mask-kind-name"
          label={texts.mask.name}
          selected={editor.kind === 'name'}
          onPress={() => editor.setKind('name')}
        />
      </Wrap>
      {editor.kind === 'number' ? (
        <View
          testID="mask-source"
          style={[styles.display, { borderColor: palette.line, backgroundColor: palette.bgCard }]}
        >
          <Text
            style={[
              styles.displayText,
              { color: editor.source === '' ? palette.fgFaint : palette.fg },
            ]}
          >
            {editor.source === '' ? texts.mask.placeholderNumber : editor.source}
          </Text>
        </View>
      ) : (
        <TextField
          testID="mask-source"
          label={texts.mask.title}
          value={editor.source}
          onChange={value => editor.setSource(value)}
          placeholder={texts.mask.placeholderName}
          monospace
        />
      )}
      <MaskState editor={editor} />
      {editor.kind === 'name' ? (
        <>
          <Wrap>
            <Chip
              testID="mask-contains"
              label={texts.mask.contains}
              onPress={() => editor.wrap('contains')}
            />
            <Chip
              testID="mask-starts"
              label={texts.mask.startsWith}
              onPress={() => editor.wrap('starts')}
            />
            <Chip
              testID="mask-exact"
              label={texts.mask.exactly}
              onPress={() => editor.wrap('exact')}
            />
            <Chip testID="mask-any-run" label="*" onPress={() => editor.insert('*')} />
            <Chip testID="mask-any-one" label="." onPress={() => editor.insert('.')} />
          </Wrap>
          <Hint text={texts.mask.field} />
          <Wrap>
            {FIELDS.map(field => (
              <Chip
                key={field}
                testID={`mask-field-${field}`}
                label={texts.group.nameField[field]}
                selected={editor.field === field}
                onPress={() => editor.setField(field)}
              />
            ))}
          </Wrap>
        </>
      ) : null}
      <TextField
        testID="mask-sample"
        label={texts.mask.check}
        value={editor.sample}
        onChange={value => editor.setSample(value)}
        placeholder={texts.mask.check}
        keyboard={editor.kind === 'number' ? 'phone-pad' : 'default'}
      />
      {sample === null ? null : (
        <Hint
          testID={`mask-sample-${sample ? 'matches' : 'no-match'}`}
          text={sample ? `✅ ${texts.mask.matches}` : `✖ ${texts.mask.noMatch}`}
        />
      )}
      <Button
        testID="mask-save"
        label={texts.common.save}
        disabled={editor.member === null || groupId === null}
        onPress={save}
      />
      {editor.kind === 'number' ? <NumberKeypad editor={editor} /> : null}
    </Screen>
  );
});

const styles = StyleSheet.create({
  display: {
    minHeight: 56,
    borderRadius: RADIUS,
    borderWidth: 1,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  displayText: { fontFamily: 'monospace', fontSize: TEXT_SIZE.title },
});
