import { observer } from 'mobx-react-lite';

import type { ScheduleEditor } from '../../contexts/policy/application/ScheduleEditor';
import type { THolidayRule } from '../../contexts/policy/domain/schedule';
import type { ITexts } from '../../texts/texts';
import { useTexts } from '../../texts/use-texts';
import { Row } from '../kit/Row';
import { Section } from '../kit/Section';
import { Sheet } from '../kit/Sheet';

export function holidaysLabel(texts: ITexts, rule: THolidayRule | null): string {
  return rule === null
    ? texts.schedule.holidaysNone
    : rule === 'also-on-holidays'
      ? texts.schedule.holidaysAlso
      : texts.schedule.holidaysNot;
}

const RULES: readonly (THolidayRule | null)[] = [null, 'not-on-holidays', 'also-on-holidays'];

/** Holidays where the phone is: as any day, never, or also, as if they were scheduled days. */
export const HolidaysSheet = observer(function HolidaysSheet({
  editor,
  onClose,
}: {
  readonly editor: ScheduleEditor;
  readonly onClose: () => void;
}) {
  const texts = useTexts();
  return (
    <Sheet visible title={texts.schedule.holidays} onClose={onClose} testID="holidays-sheet">
      <Section>
        {RULES.map(rule => (
          <Row
            key={rule ?? 'none'}
            testID={`holidays-${rule ?? 'none'}`}
            title={`${editor.holidays === rule ? '✓ ' : ''}${holidaysLabel(texts, rule)}`}
            onPress={() => {
              editor.setHolidays(rule);
              onClose();
            }}
          />
        ))}
      </Section>
    </Sheet>
  );
});
