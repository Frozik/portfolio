import { Copy } from 'lucide-react';
import { memo, useEffect, useMemo, useState } from 'react';
import { Temporal } from 'temporal-polyfill';

import { parseOtpUri } from '../../model/validation/otpauth-uri';
import type { IOneTimeCode } from '../../otp/one-time-code';
import { oneTimeCode, totpStep } from '../../otp/one-time-code';
import { SENSITIVE_CLASS } from '../sensitive-class';
import { getVaultReactTranslations } from '../translations/translations';
import styles from './totp-code.module.css';

const COPY_ICON_SIZE = 14;
const TICK_MS = 1000;
const MS_PER_SECOND = 1000;
const RING_RADIUS = 9;
const RING_CENTRE = 11;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
/** Six digits read as two groups of three, as authenticator apps show them. */
const GROUP = 3;

/** With this many seconds left the code turns orange, and red under the second mark: time to type it fast or wait. */
const SOON_SECONDS = 20;
const URGENT_SECONDS = 10;

function urgencyOf(secondsLeft: number): 'calm' | 'soon' | 'urgent' {
  if (secondsLeft < URGENT_SECONDS) {
    return 'urgent';
  }
  return secondsLeft <= SOON_SECONDS ? 'soon' : 'calm';
}

function grouped(code: string): string {
  return code.length > GROUP + 1 ? `${code.slice(0, GROUP)} ${code.slice(GROUP)}` : code;
}

/**
 * The live code of an `otp` field: computed
 * here from the stored `otpauth://` URI at the session's corrected time, new
 * every period, with a ring for the time left. Nothing is announced on its
 * own: the time left is the ring's label. Copying copies the code, never the secret.
 */
export const TotpCode = memo(
  ({
    uri,
    now,
    locale,
    onCopy,
  }: {
    readonly uri: string;
    /** The session's corrected clock. */
    readonly now: () => Temporal.Instant;
    readonly locale: string;
    readonly onCopy: (code: string) => void;
  }) => {
    const t = getVaultReactTranslations(locale).totp;
    const params = useMemo(() => parseOtpUri(uri), [uri]);
    const [instant, setInstant] = useState(now);
    const [code, setCode] = useState<IOneTimeCode | null>(null);
    const step = params.ok ? totpStep(instant, params.value.period) : null;

    useEffect(() => {
      const timer = setInterval(() => setInstant(now()), TICK_MS);
      return () => clearInterval(timer);
    }, [now]);

    useEffect(() => {
      if (!params.ok || params.value.type !== 'totp' || step === null) {
        return undefined;
      }
      let current = true;
      const stepStart = Temporal.Instant.fromEpochMilliseconds(
        step * params.value.period * MS_PER_SECOND
      );
      void oneTimeCode(params.value, { kind: 'time', at: stepStart }).then(result => {
        if (current) {
          setCode(result.ok ? result.value : null);
        }
      });
      return () => {
        current = false;
      };
    }, [params, step]);

    if (!params.ok || params.value.type !== 'totp') {
      return (
        <span className={styles.problem} data-testid="totp-unreadable">
          {t.unreadable}
        </span>
      );
    }
    const period = params.value.period * MS_PER_SECOND;
    const remaining = period - (instant.epochMilliseconds % period);
    const secondsLeft = Math.ceil(remaining / MS_PER_SECOND);
    return (
      <span className={styles.totp} data-urgency={urgencyOf(secondsLeft)}>
        <span className={`${styles.code} ${SENSITIVE_CLASS}`} aria-label={t.label}>
          {code === null ? '' : grouped(code.code)}
        </span>
        <svg
          className={styles.ring}
          viewBox="0 0 22 22"
          role="img"
          aria-label={t.secondsLeft(secondsLeft)}
        >
          <circle className={styles.track} cx={RING_CENTRE} cy={RING_CENTRE} r={RING_RADIUS} />
          <circle
            className={styles.progress}
            cx={RING_CENTRE}
            cy={RING_CENTRE}
            r={RING_RADIUS}
            strokeDasharray={RING_LENGTH}
            strokeDashoffset={RING_LENGTH * (1 - remaining / period)}
          />
        </svg>
        <button
          type="button"
          className={styles.copy}
          aria-label={t.copy}
          title={t.copy}
          disabled={code === null}
          onClick={() => code !== null && onCopy(code.code)}
        >
          <Copy size={COPY_ICON_SIZE} aria-hidden="true" />
        </button>
      </span>
    );
  }
);
