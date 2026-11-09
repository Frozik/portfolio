import { Switch } from 'react-native';

import { usePalette } from '../theme/AppTheme';
import { Row } from './Row';

/** A row that is a switch: the whole row toggles, and the switch shows the state at a glance. */
export function ToggleRow({
  title,
  subtitle,
  value,
  onChange,
  testID,
}: {
  readonly title: string;
  readonly subtitle?: string;
  readonly value: boolean;
  readonly onChange: (value: boolean) => void;
  readonly testID: string;
}) {
  const palette = usePalette();
  return (
    <Row
      testID={testID}
      title={title}
      subtitle={subtitle}
      onPress={() => onChange(!value)}
      trailing={
        <Switch
          testID={`${testID}-switch`}
          accessibilityRole="switch"
          accessibilityState={{ checked: value }}
          value={value}
          onValueChange={onChange}
          trackColor={{ false: palette.line, true: palette.accentSoft }}
          thumbColor={value ? palette.accent : palette.fgFaint}
        />
      }
    />
  );
}
