import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { Ref } from 'react';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { REVEAL_FOR_MS } from '@frozik/vault-app/exposure/application/RevealModel';

import { useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { RADIUS, TEXT_SIZE, TOUCH_SIZE } from './metrics';

const REVEAL_ICON_SIZE = 22;

const KEYBOARDS = {
  text: 'default',
  url: 'url',
  number: 'number-pad',
  email: 'email-address',
  phone: 'phone-pad',
} as const;

/**
 * A labelled input. A secret never reaches the keyboard's learning or
 * suggestions, and never the autofill of another password manager; it can be
 * shown while typing, and hides itself again after a while.
 */
export function TextField({
  label,
  value,
  onChangeText,
  testID,
  secret = false,
  kind = 'text',
  multiline = false,
  onSubmitEditing,
  inputRef,
  editable = true,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  readonly testID?: string;
  readonly secret?: boolean;
  readonly kind?: 'text' | 'url' | 'number' | 'email' | 'phone';
  readonly multiline?: boolean;
  readonly onSubmitEditing?: () => void;
  /** For a screen that gives the field the keyboard on the user's own request. */
  readonly inputRef?: Ref<TextInput>;
  /** Off while what was typed is being used: it stays in sight, and nothing new goes in. */
  readonly editable?: boolean;
}) {
  const palette = usePalette();
  const t = useVaultTexts().card;
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!shown) {
      return undefined;
    }
    const timer = setTimeout(() => setShown(false), REVEAL_FOR_MS);
    return () => clearTimeout(timer);
  }, [shown]);
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: palette.fgDim }]}>{label}</Text>
      <View style={styles.row}>
        <TextInput
          testID={testID}
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmitEditing}
          ref={inputRef}
          secureTextEntry={secret && !shown}
          editable={editable}
          autoCorrect={false}
          autoCapitalize="none"
          autoComplete="off"
          importantForAutofill={secret ? 'no' : 'auto'}
          keyboardType={KEYBOARDS[kind]}
          multiline={multiline}
          placeholderTextColor={palette.fgFaint}
          style={[
            styles.input,
            secret && styles.secretInput,
            { color: palette.fg, borderColor: palette.line, backgroundColor: palette.bgCard },
          ]}
        />
        {secret && (
          <Pressable
            testID={`${testID ?? 'secret'}-reveal`}
            accessibilityRole="button"
            accessibilityLabel={shown ? t.hide : t.show}
            accessibilityState={{ checked: shown }}
            onPress={() => setShown(current => !current)}
            style={styles.reveal}
          >
            <MaterialIcons
              name={shown ? 'visibility-off' : 'visibility'}
              size={REVEAL_ICON_SIZE}
              color={palette.fgDim}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontSize: TEXT_SIZE.small },
  row: { justifyContent: 'center' },
  input: {
    minHeight: TOUCH_SIZE,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderRadius: RADIUS,
    paddingHorizontal: 14,
    fontSize: TEXT_SIZE.body,
  },
  secretInput: { paddingRight: TOUCH_SIZE },
  reveal: {
    position: 'absolute',
    right: 0,
    width: TOUCH_SIZE,
    height: TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
