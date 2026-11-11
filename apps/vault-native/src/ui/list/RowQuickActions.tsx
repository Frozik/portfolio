import type MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { IVaultCard } from '@frozik/vault/model/card';
import { setFavorite, setProtected } from '@frozik/vault/model/card-edits';
import { parseOtpUri } from '@frozik/vault/model/validation/otpauth-uri';
import { oneTimeCode } from '@frozik/vault/otp/one-time-code';
import { selectionAsync } from 'expo-haptics';
import { observer } from 'mobx-react-lite';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { changeCard } from '@frozik/vault-app/document/application/card-actions';
import type { TRowCopyRole } from '@frozik/vault-app/document/application/row-copies';
import { rowCopiesOf } from '@frozik/vault-app/document/application/row-copies';

import { FieldAction } from '../editor/FieldActions';
import { useVaultTexts } from '../texts';
import { useCopied } from '../vault/copy-feedback';
import { useSession } from '../vault/session-context';

const ROLE_ICONS: Readonly<Record<TRowCopyRole, ComponentProps<typeof MaterialIcons>['name']>> = {
  login: 'person-outline',
  email: 'alternate-email',
  password: 'password',
  'one-time-code': 'pin',
  'card-number': 'credit-card',
  holder: 'badge',
  expiry: 'event',
  pin: 'dialpad',
  iban: 'account-balance',
  bic: 'public',
  'account-number': 'numbers',
  'bank-code': 'tag',
  'document-number': 'assignment-ind',
  host: 'dns',
  network: 'wifi',
  note: 'notes',
};

/**
 * What lies behind a row's end, uncovered when its ⋯ slides it left: what the card's kind has
 * worth pasting elsewhere (an account's login, password and code, a bank card's number, holder,
 * expiry and PIN), the star, and protection to put on. Protection comes off only in the card, behind the master password;
 * the archive and the trash are a row's swipes.
 */
export const RowQuickActions = observer(function RowQuickActions({
  card,
}: {
  readonly card: IVaultCard;
}) {
  const session = useSession();
  const announce = useCopied();
  const t = useVaultTexts();
  const shut = card.protected && !session.protectedGate.isOpen;
  const copies = shut ? [] : rowCopiesOf(card);
  const copy = (label: string, text: string): void => {
    void session.clipboard.copy(text).then(written => {
      if (written) {
        void selectionAsync();
        announce(label);
      }
    });
  };
  const copyCode = (label: string, uri: string): void => {
    const params = parseOtpUri(uri);
    if (!params.ok || params.value.type !== 'totp') {
      return;
    }
    void oneTimeCode(params.value, { kind: 'time', at: session.now() }).then(code => {
      if (code.ok) {
        copy(label, code.value.code);
      }
    });
  };
  const change = (edit: Parameters<typeof changeCard>[1]): void => {
    session.transact(changeCard(card.id, edit));
  };
  return (
    <View style={styles.actions}>
      {copies.map(entry => (
        <FieldAction
          key={entry.role}
          testID={`row-copy-${entry.role}`}
          icon={ROLE_ICONS[entry.role]}
          label={t.menu.copyField(entry.label)}
          onPress={() =>
            entry.role === 'one-time-code'
              ? copyCode(entry.label, entry.text)
              : copy(entry.label, entry.text)
          }
        />
      ))}
      {!session.readOnly && (
        <FieldAction
          testID="row-favorite"
          icon={card.favorite ? 'star' : 'star-border'}
          label={card.favorite ? t.menu.unfavorite : t.menu.favorite}
          onPress={() => change(state => setFavorite(state, !card.favorite))}
        />
      )}
      {!session.readOnly && !card.protected && (
        <FieldAction
          testID="row-protect"
          icon="lock-outline"
          label={t.menu.protect}
          onPress={() => change(state => setProtected(state, true))}
        />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', alignItems: 'center' },
});
