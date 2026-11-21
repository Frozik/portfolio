import { observer } from 'mobx-react-lite';
import { useEffect, useRef } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import type { MaskEditor } from '../../contexts/masks/application/MaskEditor';
import { useTexts } from '../../texts/use-texts';
import { RADIUS, TEXT_SIZE } from '../kit/metrics';
import { usePalette } from '../theme/AppTheme';

const FIELD_HEIGHT = 56;
const FIELD_PADDING = 14;

/**
 * The mask as it is typed on the app's own keypad: a real field, so the phone's caret blinks in
 * it, with the phone's keyboard kept away and the caret held at the end, where the keypad writes.
 */
export const MaskSourceField = observer(function MaskSourceField({
  editor,
}: {
  readonly editor: MaskEditor;
}) {
  const texts = useTexts();
  const palette = usePalette();
  const ref = useRef<TextInput>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  const end = editor.source.length;
  return (
    <TextInput
      ref={ref}
      testID="mask-source"
      accessibilityLabel={texts.mask.title}
      value={editor.source}
      onChangeText={source => editor.setSource(source)}
      placeholder={texts.mask.placeholderNumber}
      placeholderTextColor={palette.fgFaint}
      showSoftInputOnFocus={false}
      selection={{ start: end, end }}
      cursorColor={palette.accent}
      autoCorrect={false}
      autoCapitalize="none"
      style={[
        styles.field,
        { color: palette.fg, borderColor: palette.line, backgroundColor: palette.bgCard },
      ]}
    />
  );
});

const styles = StyleSheet.create({
  field: {
    minHeight: FIELD_HEIGHT,
    borderRadius: RADIUS,
    borderWidth: 1,
    paddingHorizontal: FIELD_PADDING,
    fontFamily: 'monospace',
    fontSize: TEXT_SIZE.title,
  },
});
