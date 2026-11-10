import { PhoneIncoming, PhoneOff } from 'lucide-react-native';

import type { TAction } from '../../contexts/policy/domain/action';
import { useTexts } from '../../texts/use-texts';
import { SegmentedControl } from '../kit/SegmentedControl';

/** Block or let through as one switch: red under blocking, green under letting through. */
export function ActionSwitch({
  value,
  onChange,
  prefix,
}: {
  readonly value: TAction;
  readonly onChange: (action: TAction) => void;
  readonly prefix: string;
}) {
  const texts = useTexts();
  return (
    <SegmentedControl
      segments={[
        {
          value: 'block',
          label: texts.actions.block,
          testID: `${prefix}-block`,
          icon: PhoneOff,
          tone: 'danger',
        },
        {
          value: 'pass',
          label: texts.actions.pass,
          testID: `${prefix}-pass`,
          icon: PhoneIncoming,
          tone: 'positive',
        },
      ]}
      value={value}
      onChange={onChange}
    />
  );
}
