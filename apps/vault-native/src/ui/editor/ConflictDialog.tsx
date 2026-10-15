import type { TCombineAspect, TCombineSide } from '@frozik/vault/model/card-combine';
import type { TChangedElsewhere } from '@frozik/vault/model/draft';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { CardDraftModel } from '@frozik/vault-app/document/application/CardDraftModel';
import { aspectText, changeKey, changeText } from '@frozik/vault-app/texts/document/change-wording';

import { Button } from '../kit/Button';
import { Dialog } from '../kit/Dialog';
import { TEXT_SIZE } from '../kit/metrics';
import { OptionList } from '../kit/OptionList';
import { useEditorTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';

/**
 * Saving over a change made elsewhere: what the other device saved against
 * this edit, and the parts both changed with a choice for each. Every answer
 * is a new version that descends from theirs.
 */
export const ConflictDialog = observer(function ConflictDialog({
  draft,
  conflict,
  onSaved,
}: {
  readonly draft: CardDraftModel;
  readonly conflict: TChangedElsewhere;
  readonly onSaved: () => void;
}) {
  const palette = usePalette();
  const editorTexts = useEditorTexts();
  const t = editorTexts.conflict;
  const [choices, setChoices] = useState<ReadonlyMap<TCombineAspect, TCombineSide>>(new Map());
  const resolve = (saved: boolean): void => {
    if (saved) {
      onSaved();
    }
  };
  return (
    <Dialog testID="conflict" open title={t.title} onClose={draft.dismissConflict}>
      <Text style={[styles.text, { color: palette.fgDim }]}>{t.intro}</Text>
      {conflict.draftAgainstTheirs.map(change => (
        <Text key={changeKey(change)} style={[styles.text, { color: palette.fgDim }]}>
          • {changeText(editorTexts, change)}
        </Text>
      ))}
      {conflict.clashes.length > 0 && (
        <View style={styles.clashes}>
          <Text style={[styles.text, { color: palette.fg }]}>{t.clash}</Text>
          {conflict.clashes.map(aspect => (
            <OptionList
              key={aspect}
              label={aspectText(editorTexts, aspect, draft.card, conflict.theirs)}
              value={choices.get(aspect) ?? 'theirs'}
              options={[
                { value: 'mine', label: t.mine },
                { value: 'theirs', label: t.theirs },
              ]}
              onChange={side => setChoices(new Map(choices).set(aspect, side))}
            />
          ))}
        </View>
      )}
      <Button
        testID="conflict-combine"
        label={t.combine}
        onPress={() => resolve(draft.save({ kind: 'combine', choices }))}
      />
      <Button
        variant="secondary"
        label={t.keepMine}
        onPress={() => resolve(draft.save({ kind: 'keep-mine' }))}
      />
      <Button
        variant="secondary"
        label={t.takeTheirs}
        onPress={() => resolve(draft.save({ kind: 'take-theirs' }))}
      />
    </Dialog>
  );
});

const styles = StyleSheet.create({
  text: { fontSize: TEXT_SIZE.small },
  clashes: { gap: 8 },
});
