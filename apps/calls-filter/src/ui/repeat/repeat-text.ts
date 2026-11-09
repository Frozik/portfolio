import type { Temporal } from 'temporal-polyfill';

import type { TRepeatPass } from '../../contexts/policy/domain/repeat-pass';
import { isRepeatPassOn } from '../../contexts/policy/domain/repeat-pass';
import type { ITexts } from '../../texts/texts';
import { momentText } from '../format';

/** «Off», «Always» or «Until 18:00»; a term that ran out reads as off. */
export function repeatText(
  texts: ITexts,
  repeat: TRepeatPass,
  now: Temporal.Instant,
  zone: string,
  today: Temporal.PlainDate
): string {
  if (!isRepeatPassOn(repeat, now)) {
    return texts.repeat.off;
  }
  return repeat.kind === 'until'
    ? texts.repeat.until(
        momentText(texts, repeat.until.toZonedDateTimeISO(zone).toPlainDateTime(), today)
      )
    : texts.repeat.always;
}
