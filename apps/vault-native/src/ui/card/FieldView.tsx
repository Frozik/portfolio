import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { TCardId } from '@frozik/vault/model/ids';
import { selectionAsync } from 'expo-haptics';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type {
  IValueReading,
  TFieldReading,
} from '@frozik/vault-app/document/application/card-reading';

import { TEXT_SIZE, TOUCH_SIZE } from '../kit/metrics';
import { useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { useOpenLink } from '../useOpenLink';
import { useCopied } from '../vault/copy-feedback';
import { useSession } from '../vault/session-context';
import { LargeType } from './LargeType';
import { OneTimeCode } from './OneTimeCode';

const ICON_SIZE = 20;
/** The copy icon turns into a check for a moment: the copy happened here. */
const COPIED_MARK_MS = 1500;
const WEB_ADDRESS = /^https?:\/\//i;

function IconAction({
  icon,
  label,
  onPress,
  testID,
}: {
  readonly icon: ComponentProps<typeof MaterialIcons>['name'];
  readonly label: string;
  readonly onPress: () => void;
  readonly testID?: string;
}) {
  const palette = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.action}
    >
      <MaterialIcons name={icon} size={ICON_SIZE} color={palette.fgDim} />
    </Pressable>
  );
}

/** Copied to the clipboard with a tick under the finger; the snackbar says what and for how long. */
function useCopy(label: string): {
  readonly copied: boolean;
  readonly copy: (text: string) => void;
} {
  const session = useSession();
  const announce = useCopied();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) {
      return undefined;
    }
    const timer = setTimeout(() => setCopied(false), COPIED_MARK_MS);
    return () => clearTimeout(timer);
  }, [copied]);
  const copy = (text: string): void => {
    void session.clipboard.copy(text).then(written => {
      if (written) {
        void selectionAsync();
        announce(label);
      }
      setCopied(written);
    });
  };
  return { copied, copy };
}

const ValueRow = observer(function ValueRow({
  field,
  value,
}: {
  readonly field: Extract<TFieldReading, { readonly kind: 'values' }>;
  readonly value: IValueReading;
}) {
  const session = useSession();
  const palette = usePalette();
  const openLink = useOpenLink();
  const t = useVaultTexts();
  const { copied, copy } = useCopy(field.label);
  const [large, setLarge] = useState(false);
  /** A card the gate shut again hides what was shown, though the reveal's own time is not up. */
  const masked =
    field.sensitive && (!field.copyable || !session.reveal.isRevealed(field.id, value.index));
  const opensSite = !field.sensitive && WEB_ADDRESS.test(value.text);
  return (
    <View style={styles.value}>
      <Text
        testID="field-value"
        accessibilityLabel={masked ? `${field.label}, ${t.card.hidden}` : undefined}
        style={[styles.text, { color: palette.fg }]}
      >
        {masked ? t.card.hidden : value.text}
      </Text>
      {field.sensitive && field.copyable && (
        <IconAction
          testID="reveal"
          icon={masked ? 'visibility' : 'visibility-off'}
          label={masked ? t.card.show : t.card.hide}
          onPress={() => session.reveal.toggle(field.id, value.index)}
        />
      )}
      {field.largeType && (
        <IconAction icon="open-in-full" label={t.cardExtras.large} onPress={() => setLarge(true)} />
      )}
      {opensSite && (
        <IconAction icon="open-in-new" label={value.text} onPress={() => openLink(value.text)} />
      )}
      {field.copyable && (
        <IconAction
          testID="copy"
          icon={copied ? 'check' : 'content-copy'}
          label={t.card.copy}
          onPress={() => copy(value.copyText)}
        />
      )}
      {large && (
        <LargeType label={field.label} value={value.text} onClose={() => setLarge(false)} />
      )}
    </View>
  );
});

/** A field as read: its label, then each value with its actions on the right. */
export const FieldView = observer(function FieldView({
  field,
  cardId,
}: {
  readonly field: TFieldReading;
  readonly cardId: TCardId;
}) {
  const palette = usePalette();
  const t = useVaultTexts().card;
  const { copy } = useCopy(field.label);
  return (
    <View testID="card-field" style={[styles.field, { borderBottomColor: palette.lineSoft }]}>
      <Text style={[styles.label, { color: palette.fgFaint }]}>{field.label}</Text>
      {field.kind === 'one-time-code' && (
        <OneTimeCode uri={field.uri} cardId={cardId} fieldId={field.id} onCopy={copy} />
      )}
      {field.kind === 'files' && (
        <Text style={[styles.label, { color: palette.fgDim }]}>
          {field.assetIds.length === 0 ? t.hidden : `${field.assetIds.length}`}
        </Text>
      )}
      {field.kind === 'values' &&
        field.values.map(value => (
          <View key={value.index}>
            {!isNil(value.turn) && (
              <Text style={[styles.turn, { color: palette.fgFaint }]}>
                {value.turn === 'current' ? t.currentPassword : t.previousPassword}
              </Text>
            )}
            <ValueRow field={field} value={value} />
          </View>
        ))}
    </View>
  );
});

const styles = StyleSheet.create({
  field: { gap: 4, paddingVertical: 10, borderBottomWidth: 1 },
  label: { fontSize: TEXT_SIZE.caption },
  turn: { fontSize: 11 },
  value: { flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1, fontSize: TEXT_SIZE.body, fontFamily: 'monospace' },
  action: { width: TOUCH_SIZE, height: TOUCH_SIZE, alignItems: 'center', justifyContent: 'center' },
});
