import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { advanceHotpCounter, hotpCounterOf } from '@frozik/vault/model/hotp-counters';
import type { TCardId, TFieldId } from '@frozik/vault/model/ids';
import { parseOtpUri } from '@frozik/vault/model/validation/otpauth-uri';
import type { IOneTimeCode } from '@frozik/vault/otp/one-time-code';
import { oneTimeCode, totpStep } from '@frozik/vault/otp/one-time-code';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Temporal } from 'temporal-polyfill';

import { Button } from '../kit/Button';
import { GAP, TEXT_SIZE, TOUCH_SIZE } from '../kit/metrics';
import { useWidgetTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { useSession } from '../vault/session-context';

const TICK_MS = 1000;
const MS_PER_SECOND = 1000;
const GROUP = 3;
const URGENT_SECONDS = 10;

function grouped(code: string): string {
  return code.length > GROUP + 1 ? `${code.slice(0, GROUP)} ${code.slice(GROUP)}` : code;
}

/**
 * The live code of an `otp` field from its `otpauth://` URI: a time-based one
 * new every period at the session's corrected time, or a counter-based one the
 * user moves on once used (the counter syncs to every device). Copying copies
 * the code, never the secret.
 */
export const OneTimeCode = observer(function OneTimeCode({
  uri,
  cardId,
  fieldId,
  onCopy,
}: {
  readonly uri: string;
  readonly cardId: TCardId;
  readonly fieldId: TFieldId;
  readonly onCopy: (code: string) => void;
}) {
  const session = useSession();
  const palette = usePalette();
  const t = useWidgetTexts().totp;
  const params = useMemo(() => parseOtpUri(uri), [uri]);
  const [instant, setInstant] = useState(session.now);
  const [code, setCode] = useState<IOneTimeCode | null>(null);
  const timed = params.ok && params.value.type === 'totp';
  const moment = !params.ok
    ? null
    : params.value.type === 'totp'
      ? totpStep(instant, params.value.period)
      : hotpCounterOf(session.document, cardId, fieldId, params.value.counter);
  useEffect(() => {
    if (!timed) {
      return undefined;
    }
    const timer = setInterval(() => setInstant(session.now()), TICK_MS);
    return () => clearInterval(timer);
  }, [session, timed]);
  useEffect(() => {
    if (!params.ok || moment === null) {
      return undefined;
    }
    let current = true;
    const at =
      params.value.type === 'totp'
        ? ({
            kind: 'time',
            at: Temporal.Instant.fromEpochMilliseconds(
              moment * params.value.period * MS_PER_SECOND
            ),
          } as const)
        : ({ kind: 'counter', counter: moment } as const);
    void oneTimeCode(params.value, at).then(result => {
      if (current) {
        setCode(result.ok ? result.value : null);
      }
    });
    return () => {
      current = false;
    };
  }, [params, moment]);
  if (!params.ok) {
    return <Text style={{ color: palette.danger, fontSize: TEXT_SIZE.small }}>{t.unreadable}</Text>;
  }
  const secondsLeft =
    isNil(code) || isNil(code.validUntil)
      ? null
      : Math.max(
          0,
          Math.ceil((code.validUntil.epochMilliseconds - instant.epochMilliseconds) / MS_PER_SECOND)
        );
  return (
    <View style={styles.row}>
      <Pressable
        testID="one-time-code"
        accessibilityRole="button"
        accessibilityLabel={t.copy}
        disabled={code === null}
        onPress={() => code !== null && onCopy(code.code)}
        style={styles.code}
      >
        <Text style={[styles.digits, { color: palette.fg }]}>
          {code === null ? '—' : grouped(code.code)}
        </Text>
        {code !== null && (
          <MaterialIcons name="content-copy" size={COPY_ICON_SIZE} color={palette.fgDim} />
        )}
        {secondsLeft !== null && (
          <Text
            style={[
              styles.left,
              { color: secondsLeft < URGENT_SECONDS ? palette.danger : palette.fgFaint },
            ]}
          >
            {t.secondsLeft(secondsLeft)}
          </Text>
        )}
      </Pressable>
      {params.value.type === 'hotp' && (
        <Button
          testID="next-code"
          variant="secondary"
          label={t.next}
          disabled={session.readOnly}
          onPress={() => {
            const { counter } = params.value;
            session.apply(document => advanceHotpCounter(document, cardId, fieldId, counter));
          }}
        />
      )}
    </View>
  );
});

const COPY_ICON_SIZE = 18;

const styles = StyleSheet.create({
  row: { gap: GAP },
  code: { minHeight: TOUCH_SIZE, flexDirection: 'row', alignItems: 'center', gap: GAP },
  digits: { fontSize: TEXT_SIZE.title, fontVariant: ['tabular-nums'], letterSpacing: 1 },
  left: { fontSize: TEXT_SIZE.caption },
});
