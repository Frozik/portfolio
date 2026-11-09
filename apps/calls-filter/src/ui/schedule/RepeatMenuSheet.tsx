import { observer } from 'mobx-react-lite';

import type { TRepeatPreset } from '../../contexts/policy/application/repeat-presets';
import type { ScheduleEditor } from '../../contexts/policy/application/ScheduleEditor';
import { useTexts } from '../../texts/use-texts';
import { Row } from '../kit/Row';
import { Section } from '../kit/Section';
import { Sheet } from '../kit/Sheet';
import { presetLabel } from './repeat-label';

const PRESETS: readonly Exclude<TRepeatPreset, 'custom'>[] = [
  'once',
  'daily',
  'weekdays',
  'weekends',
  'weekly',
  'monthly',
  'yearly',
];

/** Google Calendar's «Does not repeat ▾»: the common repeats, then «Custom…». */
export const RepeatMenuSheet = observer(function RepeatMenuSheet({
  editor,
  onCustom,
  onClose,
}: {
  readonly editor: ScheduleEditor;
  readonly onCustom: () => void;
  readonly onClose: () => void;
}) {
  const texts = useTexts();
  return (
    <Sheet visible title={texts.schedule.repeat} onClose={onClose} testID="repeat-menu">
      <Section>
        {PRESETS.map(preset => (
          <Row
            key={preset}
            testID={`repeat-${preset}`}
            title={`${editor.preset === preset ? '✓ ' : ''}${presetLabel(texts, preset, editor.start)}`}
            onPress={() => {
              editor.setPreset(preset);
              onClose();
            }}
          />
        ))}
        <Row
          testID="repeat-custom"
          title={`${editor.preset === 'custom' ? '✓ ' : ''}${texts.schedule.custom}`}
          onPress={onCustom}
        />
      </Section>
    </Sheet>
  );
});
