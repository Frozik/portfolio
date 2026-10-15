import type { ICardField, IVaultCard } from '@frozik/vault/model/card';
import { allFields } from '@frozik/vault/model/card';
import { cardSubtitle } from '@frozik/vault/model/card-subtitle';
import { FIELD_KINDS } from '@frozik/vault/model/field-kinds/registry';
import { isNil } from 'lodash-es';
import { StyleSheet, Text, View } from 'react-native';

import { RADIUS, TEXT_SIZE } from '../kit/metrics';
import { useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';

const CARD_RATIO = 1.586;

function singleFieldOf(card: IVaultCard, kind: ICardField['spec']['kind']): ICardField | null {
  return (
    allFields(card).find(
      candidate =>
        candidate.spec.kind === kind &&
        candidate.value.cardinality === 'single' &&
        candidate.value.value !== ''
    ) ?? null
  );
}

function textOf(field: ICardField | null): string {
  return field?.value.cardinality === 'single' ? field.value.value : '';
}

/**
 * A bank card drawn as the plastic it stands for: the number as `•••• 1234`,
 * holder and "valid thru". Nothing secret is drawn: the full number, CVV and
 * PIN stay in their fields below.
 */
export function BankCardFace({ card }: { readonly card: IVaultCard }) {
  const palette = usePalette();
  const t = useVaultTexts().cardExtras;
  const masked = cardSubtitle(card);
  if (isNil(masked)) {
    return null;
  }
  const holder = textOf(singleFieldOf(card, 'text'));
  const validThru = singleFieldOf(card, 'expiry-month');
  return (
    <View testID="bank-card" style={[styles.face, { backgroundColor: palette.accent }]}>
      <Text style={[styles.number, { color: palette.onAccent }]}>{masked}</Text>
      <View style={styles.bottom}>
        <Text style={[styles.small, { color: palette.onAccent }]}>{holder}</Text>
        {!isNil(validThru) && (
          <Text style={[styles.small, { color: palette.onAccent }]}>
            {t.validThru} {FIELD_KINDS['expiry-month'].format(textOf(validThru), validThru.spec)}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  face: {
    aspectRatio: CARD_RATIO,
    borderRadius: RADIUS,
    padding: 20,
    justifyContent: 'space-between',
  },
  number: { fontSize: TEXT_SIZE.title, letterSpacing: 2, marginTop: 'auto', marginBottom: 'auto' },
  bottom: { flexDirection: 'row', justifyContent: 'space-between' },
  small: { fontSize: TEXT_SIZE.small },
});
